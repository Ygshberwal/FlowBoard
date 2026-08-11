from app.config import Settings


def test_default_cors_origins_list_splits_and_strips():
    s = Settings(cors_origins="  https://a.com , https://b.com  ")
    assert s.cors_origins_list == ["https://a.com", "https://b.com"]


def test_default_settings_have_local_cors():
    s = Settings()
    assert "http://localhost:5173" in s.cors_origins_list


def test_secret_key_removed_from_settings():
    assert not hasattr(Settings(), "secret_key")


def test_database_url_is_normalized_for_asyncpg():
    value = "postgresql://neondb_owner:secret@host/dbname?sslmode=require"
    s = Settings(database_url=value)
    assert s.database_url.startswith("postgresql+asyncpg://")
    assert "sslmode=require" not in s.database_url
    assert "ssl=true" in s.database_url
