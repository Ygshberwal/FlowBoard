from __future__ import annotations
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import get_settings
from app.models.user import User
from app.redis_client import get_redis
from app.schemas.user import RegisterRequest, UserUpdate

settings = get_settings()
_ph = PasswordHasher()


def hash_password(plain: str) -> str:
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, plain)
    except (VerifyMismatchError, InvalidHash, Exception):
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: uuid.UUID, token_version: int) -> str:
    now = _now()
    exp = now + timedelta(minutes=settings.access_token_minutes)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "ver": token_version,
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return _encode(payload)


def create_refresh_token(user_id: uuid.UUID, token_version: int) -> Tuple[str, str, int]:
    now = _now()
    exp = now + timedelta(days=settings.refresh_token_days)
    jti = str(uuid.uuid4())
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "ver": token_version,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return _encode(payload), jti, int(exp.timestamp())


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        ) from e
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from e


async def is_refresh_revoked(jti: str) -> bool:
    redis = await get_redis()
    return bool(await redis.exists(f"revoked_refresh:{jti}"))


async def revoke_refresh(jti: str, exp_unix: int) -> None:
    ttl = max(1, exp_unix - int(_now().timestamp()))
    redis = await get_redis()
    await redis.setex(f"revoked_refresh:{jti}", ttl, "1")


async def register(db: AsyncSession, req: RegisterRequest) -> User:
    user = User(
        username=req.username,
        email=req.email,
        password_hash=hash_password(req.password),
        mobile_number=req.mobile_number,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="username or email already taken",
        ) from e
    await db.refresh(user)
    return user


async def authenticate(
    db: AsyncSession, identifier: str, password: str
) -> Optional[User]:
    ident = identifier.strip().lower()
    result = await db.execute(
        select(User).where(
            or_(func.lower(User.username) == ident, func.lower(User.email) == ident)
        )
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def issue_token_pair(user: User) -> Tuple[str, str]:
    access = create_access_token(user.id, user.token_version)
    refresh, _jti, _exp = create_refresh_token(user.id, user.token_version)
    return access, refresh


async def update_user(
    db: AsyncSession, user: User, data: UserUpdate
) -> Tuple[User, bool]:
    values = data.model_dump(exclude_unset=True)
    values.pop("current_password", None)

    sensitive_changed = False
    new_password = values.pop("password", None)
    if new_password is not None:
        user.password_hash = hash_password(new_password)
        user.token_version = (user.token_version or 0) + 1
        sensitive_changed = True

    for field, value in values.items():
        if value is not None:
            setattr(user, field, value)
    try:
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="username or email already taken",
        ) from e
    await db.refresh(user)
    return user, sensitive_changed


async def delete_user(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.flush()
