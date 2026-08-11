from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://flowboard:flowboard@postgres:5432/flowboard"
    redis_url: str = "redis://redis:6379/0"
    cors_origins: str = "http://localhost:5173,http://localhost:80"
    jwt_secret: str = "change-me-in-dev-only"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    upload_dir: str = "uploads"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if not isinstance(value, str):
            return value

        normalized = value.strip()

        if normalized.startswith("postgresql+psycopg2://"):
            normalized = normalized.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
        elif normalized.startswith("postgresql://"):
            normalized = normalized.replace("postgresql://", "postgresql+asyncpg://", 1)

        normalized = normalized.replace("?sslmode=require", "")
        normalized = normalized.replace("&sslmode=require", "")

        if "?" in normalized:
            if normalized.endswith("?"):
                normalized = normalized[:-1]
        else:
            normalized = normalized

        return normalized

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
