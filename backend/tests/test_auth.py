from __future__ import annotations
import time


def test_password_hash_roundtrip():
    from app.services.auth_service import hash_password, verify_password

    hashed = hash_password("super-secret-42")
    assert hashed != "super-secret-42"
    assert verify_password("super-secret-42", hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_password_hash_rejects_garbage():
    from app.services.auth_service import verify_password

    assert verify_password("anything", "not-a-hash") is False


def test_register_login_me(client, user_a):
    login_resp = client.post(
        "/api/auth/login",
        json={
            "identifier": user_a["credentials"]["username"],
            "password": user_a["credentials"]["password"],
        },
    )
    assert login_resp.status_code == 200, login_resp.text
    body = login_resp.json()
    assert "access_token" in body and "refresh_token" in body
    assert body["user"]["username"] == user_a["credentials"]["username"]
    assert "password_hash" not in body["user"]

    me_resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me_resp.status_code == 200
    me = me_resp.json()
    assert me["email"] == user_a["credentials"]["email"]
    assert "password_hash" not in me


def test_login_by_email(client, user_a):
    resp = client.post(
        "/api/auth/login",
        json={
            "identifier": user_a["credentials"]["email"].upper(),
            "password": user_a["credentials"]["password"],
        },
    )
    assert resp.status_code == 200


def test_login_wrong_password_is_401(client, user_a):
    resp = client.post(
        "/api/auth/login",
        json={
            "identifier": user_a["credentials"]["username"],
            "password": "definitely-wrong",
        },
    )
    assert resp.status_code == 401


def test_duplicate_username_is_409(client, user_a):
    payload = {
        "username": user_a["credentials"]["username"],
        "email": "second-email@example.com",
        "password": "another-strong-password",
        "mobile_number": "+911234567891",
    }
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 409


def test_duplicate_email_is_409(client, user_a):
    payload = {
        "username": "differentuser",
        "email": user_a["credentials"]["email"],
        "password": "another-strong-password",
        "mobile_number": "+911234567891",
    }
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 409


def test_register_validation_errors_are_422(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "username": "ab",
            "email": "not-an-email",
            "password": "short",
            "mobile_number": "123",
        },
    )
    assert resp.status_code == 422


def test_me_without_auth_is_401(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_with_bad_bearer_is_401(client):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert resp.status_code == 401


def test_refresh_rotation_revokes_old_refresh(client, user_a):
    time.sleep(1)
    refresh_resp = client.post(
        "/api/auth/refresh",
        json={"refresh_token": user_a["refresh_token"]},
    )
    assert refresh_resp.status_code == 200, refresh_resp.text
    new_pair = refresh_resp.json()
    assert new_pair["refresh_token"] != user_a["refresh_token"]

    reuse = client.post(
        "/api/auth/refresh",
        json={"refresh_token": user_a["refresh_token"]},
    )
    assert reuse.status_code == 401


def test_logout_revokes_refresh(client, user_a):
    logout_resp = client.post(
        "/api/auth/logout",
        headers=user_a["auth_headers"],
        json={"refresh_token": user_a["refresh_token"]},
    )
    assert logout_resp.status_code == 204

    reuse = client.post(
        "/api/auth/refresh",
        json={"refresh_token": user_a["refresh_token"]},
    )
    assert reuse.status_code == 401


def test_patch_me_password_requires_current_password(client, user_a):
    resp = client.patch(
        "/api/auth/me",
        headers=user_a["auth_headers"],
        json={"password": "brand-new-password-1"},
    )
    assert resp.status_code == 400
    assert "current_password" in resp.text


def test_patch_me_password_rejects_wrong_current(client, user_a):
    resp = client.patch(
        "/api/auth/me",
        headers=user_a["auth_headers"],
        json={
            "password": "brand-new-password-1",
            "current_password": "not-the-real-one",
        },
    )
    assert resp.status_code == 400


def test_patch_me_password_rotates_tokens_and_invalidates_old(client, user_a):
    old_access = user_a["access_token"]
    resp = client.patch(
        "/api/auth/me",
        headers=user_a["auth_headers"],
        json={
            "password": "brand-new-password-1",
            "current_password": user_a["credentials"]["password"],
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "password_hash" not in body["user"]
    assert body["access_token"] and body["refresh_token"]
    assert body["access_token"] != old_access

    old_me = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {old_access}"},
    )
    assert old_me.status_code == 401

    new_me = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert new_me.status_code == 200

    old_login = client.post(
        "/api/auth/login",
        json={
            "identifier": user_a["credentials"]["username"],
            "password": user_a["credentials"]["password"],
        },
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/auth/login",
        json={
            "identifier": user_a["credentials"]["username"],
            "password": "brand-new-password-1",
        },
    )
    assert new_login.status_code == 200


def test_patch_me_email_requires_current_password(client, user_a):
    without = client.patch(
        "/api/auth/me",
        headers=user_a["auth_headers"],
        json={"email": "renamed@example.com"},
    )
    assert without.status_code == 400

    with_ok = client.patch(
        "/api/auth/me",
        headers=user_a["auth_headers"],
        json={
            "email": "renamed@example.com",
            "current_password": user_a["credentials"]["password"],
        },
    )
    assert with_ok.status_code == 200
    assert with_ok.json()["user"]["email"] == "renamed@example.com"


def test_patch_me_username_does_not_require_current_password(client, user_a):
    resp = client.patch(
        "/api/auth/me",
        headers=user_a["auth_headers"],
        json={"username": "renamed_user"},
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["username"] == "renamed_user"


def test_refresh_after_password_change_is_401(client, user_a):
    stale_refresh = user_a["refresh_token"]
    change = client.patch(
        "/api/auth/me",
        headers=user_a["auth_headers"],
        json={
            "password": "brand-new-password-1",
            "current_password": user_a["credentials"]["password"],
        },
    )
    assert change.status_code == 200

    reuse = client.post(
        "/api/auth/refresh",
        json={"refresh_token": stale_refresh},
    )
    assert reuse.status_code == 401


def test_avatar_upload_rejects_bad_type(client, user_a):
    resp = client.post(
        "/api/auth/me/avatar",
        headers=user_a["auth_headers"],
        files={"file": ("hello.txt", b"not an image", "text/plain")},
    )
    assert resp.status_code == 415


def test_avatar_upload_rejects_oversize(client, user_a):
    huge = b"\x89PNG\r\n\x1a\n" + b"\0" * (2 * 1024 * 1024 + 10)
    resp = client.post(
        "/api/auth/me/avatar",
        headers=user_a["auth_headers"],
        files={"file": ("big.png", huge, "image/png")},
    )
    assert resp.status_code == 413


def _tiny_png() -> bytes:
    from PIL import Image
    import io

    buf = io.BytesIO()
    Image.new("RGB", (2, 2), (128, 64, 200)).save(buf, format="PNG")
    return buf.getvalue()


def test_avatar_upload_then_delete(client, user_a):
    png = _tiny_png()
    upload = client.post(
        "/api/auth/me/avatar",
        headers=user_a["auth_headers"],
        files={"file": ("me.png", png, "image/png")},
    )
    assert upload.status_code == 200, upload.text
    body = upload.json()
    assert body["avatar_url"].startswith("/api/uploads/avatars/")

    me = client.get("/api/auth/me", headers=user_a["auth_headers"])
    assert me.json()["avatar_url"] == body["avatar_url"]

    served = client.get(body["avatar_url"])
    assert served.status_code == 200
    assert served.headers.get("content-type", "").startswith("image/")

    deleted = client.delete("/api/auth/me/avatar", headers=user_a["auth_headers"])
    assert deleted.status_code == 200
    assert deleted.json()["avatar_url"] is None

    served_after = client.get(body["avatar_url"])
    assert served_after.status_code == 404


def test_delete_account_requires_correct_current_password(client, user_a):
    wrong = client.request(
        "DELETE",
        "/api/auth/me",
        headers=user_a["auth_headers"],
        json={"current_password": "not-my-password"},
    )
    assert wrong.status_code == 400

    right = client.request(
        "DELETE",
        "/api/auth/me",
        headers=user_a["auth_headers"],
        json={"current_password": user_a["credentials"]["password"]},
    )
    assert right.status_code == 204

    me_after = client.get("/api/auth/me", headers=user_a["auth_headers"])
    assert me_after.status_code == 401

    relogin = client.post(
        "/api/auth/login",
        json={
            "identifier": user_a["credentials"]["username"],
            "password": user_a["credentials"]["password"],
        },
    )
    assert relogin.status_code == 401


def test_delete_account_cascades_owned_data(client, user_a):
    section = client.post(
        "/api/sections",
        headers=user_a["auth_headers"],
        json={"name": "delete-me-cascades"},
    )
    assert section.status_code == 201
    section_id = section.json()["id"]

    deleted = client.request(
        "DELETE",
        "/api/auth/me",
        headers=user_a["auth_headers"],
        json={"current_password": user_a["credentials"]["password"]},
    )
    assert deleted.status_code == 204

    fresh = client.post(
        "/api/auth/register",
        json={
            "username": "second_owner",
            "email": "second@example.com",
            "password": "correct-horse-battery-staple",
            "mobile_number": "+911234567890",
        },
    )
    assert fresh.status_code == 201
    fresh_headers = {"Authorization": f"Bearer {fresh.json()['access_token']}"}
    board = client.get("/api/sections/board", headers=fresh_headers)
    assert board.status_code == 200
    assert all(s["id"] != section_id for s in board.json())

    hijack = client.patch(
        f"/api/sections/{section_id}",
        headers=fresh_headers,
        json={"name": "hijack"},
    )
    assert hijack.status_code == 404


def test_delete_avatar_when_none_returns_ok(client, user_a):
    resp = client.delete("/api/auth/me/avatar", headers=user_a["auth_headers"])
    assert resp.status_code == 200
    assert resp.json()["avatar_url"] is None
