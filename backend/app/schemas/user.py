from __future__ import annotations
import re
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]+$")
MOBILE_RE = re.compile(r"^\+[1-9]\d{6,14}$")


def _validate_username(value: str) -> str:
    if not (3 <= len(value) <= 32):
        raise ValueError("username must be 3-32 characters")
    if not USERNAME_RE.match(value):
        raise ValueError("username may only contain letters, digits, '_', '.', '-'")
    return value.lower()


def _validate_mobile(value: str) -> str:
    if not MOBILE_RE.match(value):
        raise ValueError("mobile_number must be E.164 like +1234567890")
    return value


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: EmailStr
    mobile_number: str
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(min_length=8)
    mobile_number: str

    @field_validator("username")
    @classmethod
    def _v_username(cls, v: str) -> str:
        return _validate_username(v)

    @field_validator("mobile_number")
    @classmethod
    def _v_mobile(cls, v: str) -> str:
        return _validate_mobile(v)

    @field_validator("email")
    @classmethod
    def _v_email(cls, v: str) -> str:
        return v.lower()


class LoginRequest(BaseModel):
    identifier: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterResponse(TokenPair):
    user: UserOut


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile_number: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8)
    current_password: Optional[str] = None

    @field_validator("username")
    @classmethod
    def _v_username(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return _validate_username(v)

    @field_validator("mobile_number")
    @classmethod
    def _v_mobile(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return _validate_mobile(v)

    @field_validator("email")
    @classmethod
    def _v_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return v.lower()


class DeleteAccountRequest(BaseModel):
    current_password: str


class AvatarUploadResponse(BaseModel):
    avatar_url: str


class UserUpdateResponse(BaseModel):
    user: UserOut
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: Optional[str] = None
