from __future__ import annotations
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.user import (
    AvatarUploadResponse,
    DeleteAccountRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    TokenPair,
    UserOut,
    UserUpdate,
    UserUpdateResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()

ALLOWED_AVATAR_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
AVATAR_EXTS = ("png", "jpg", "jpeg", "webp")
MAX_AVATAR_BYTES = 2 * 1024 * 1024


def _avatars_dir() -> Path:
    backend_root = Path(__file__).resolve().parent.parent.parent
    d = backend_root / settings.upload_dir / "avatars"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _delete_avatar_files(user_id: uuid.UUID) -> None:
    d = _avatars_dir()
    for ext in AVATAR_EXTS:
        stale = d / f"{user_id}.{ext}"
        if stale.exists():
            try:
                stale.unlink()
            except OSError:
                pass


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.register(db, req)
    access, refresh = await auth_service.issue_token_pair(user)
    return RegisterResponse(
        user=UserOut.model_validate(user),
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/login", response_model=RegisterResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    # TODO(security): add rate-limiting on this endpoint (SlowAPI or a WAF)
    # before exposing publicly (see nextsteps.md §1 and §10). For now we rely
    # on Argon2's cost to slow brute-force and return a generic "Invalid
    # credentials" so we don't leak whether the user exists.
    user = await auth_service.authenticate(db, req.identifier, req.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    access, refresh = await auth_service.issue_token_pair(user)
    return RegisterResponse(
        user=UserOut.model_validate(user),
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = auth_service.decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong token type"
        )
    jti = payload.get("jti")
    exp = int(payload.get("exp", 0))
    sub = payload.get("sub")
    if not jti or not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    if await auth_service.is_refresh_revoked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked"
        )
    try:
        user_id = uuid.UUID(sub)
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid subject"
        ) from e
    user = await auth_service.get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    if int(payload.get("ver", 0)) != int(user.token_version or 0):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalidated; please sign in again",
        )
    await auth_service.revoke_refresh(jti, exp)
    access, new_refresh = await auth_service.issue_token_pair(user)
    return TokenPair(access_token=access, refresh_token=new_refresh)


@router.post("/logout", status_code=204)
async def logout(
    req: LogoutRequest,
    _current: User = Depends(get_current_user),
):
    try:
        payload = auth_service.decode_token(req.refresh_token)
    except HTTPException:
        return Response(status_code=204)
    if payload.get("type") != "refresh":
        return Response(status_code=204)
    jti = payload.get("jti")
    exp = int(payload.get("exp", 0))
    if jti:
        await auth_service.revoke_refresh(jti, exp)
    return Response(status_code=204)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserUpdateResponse)
async def patch_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    payload = data.model_dump(exclude_unset=True)
    wants_password_change = payload.get("password") is not None
    wants_email_change = (
        "email" in payload
        and payload.get("email") is not None
        and payload["email"] != current_user.email
    )

    if wants_password_change or wants_email_change:
        supplied = payload.get("current_password")
        if not supplied or not auth_service.verify_password(
            supplied, current_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="current_password is required and must match",
            )

    updated, sensitive_changed = await auth_service.update_user(db, current_user, data)
    if sensitive_changed:
        access, refresh = await auth_service.issue_token_pair(updated)
        return UserUpdateResponse(
            user=UserOut.model_validate(updated),
            access_token=access,
            refresh_token=refresh,
            token_type="bearer",
        )
    return UserUpdateResponse(user=UserOut.model_validate(updated))


@router.post("/me/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PNG, JPEG, or WebP images are allowed",
        )
    data = await file.read()
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Avatar must be 2 MB or smaller",
        )
    try:
        from PIL import Image
        import io

        Image.open(io.BytesIO(data)).verify()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Uploaded file is not a valid image",
        ) from e

    ext = ALLOWED_AVATAR_TYPES[content_type]
    _delete_avatar_files(current_user.id)
    target = _avatars_dir() / f"{current_user.id}.{ext}"
    target.write_bytes(data)

    avatar_url = f"/api/uploads/avatars/{current_user.id}.{ext}"
    current_user.avatar_url = avatar_url
    await db.flush()
    return AvatarUploadResponse(avatar_url=avatar_url)


@router.delete("/me/avatar", response_model=UserOut)
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _delete_avatar_files(current_user.id)
    current_user.avatar_url = None
    await db.flush()
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.delete("/me", status_code=204)
async def delete_me(
    req: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not auth_service.verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="current_password does not match",
        )
    _delete_avatar_files(current_user.id)
    await auth_service.delete_user(db, current_user)
    return Response(status_code=204)
