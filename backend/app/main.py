import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import engine
from app.redis_client import close_redis
from app.routers import tasks, habits, analytics, sections, auth

settings = get_settings()

BACKEND_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = BACKEND_ROOT / settings.upload_dir


def run_migrations() -> None:
    try:
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            cwd=str(BACKEND_ROOT),
        )
    except FileNotFoundError as e:
        raise RuntimeError(
            "alembic executable not found in the active Python environment; "
            "install requirements.txt before starting the app."
        ) from e

    if result.stdout:
        print(result.stdout, file=sys.stdout)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        raise RuntimeError(
            f"alembic upgrade head failed (exit {result.returncode}); "
            "aborting startup so requests never hit a broken schema."
        )
    print("Migrations applied successfully.")


def ensure_upload_dirs() -> None:
    (UPLOAD_ROOT / "avatars").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    ensure_upload_dirs()
    yield
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title="FlowBoard API",
    version="1.0.0",
    description="Daily Planner + Habit Tracker API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ensure_upload_dirs()
app.mount(
    "/api/uploads",
    StaticFiles(directory=str(UPLOAD_ROOT)),
    name="uploads",
)

app.include_router(auth.router)
app.include_router(sections.router)
app.include_router(tasks.router)
app.include_router(habits.router)
app.include_router(analytics.router)


@app.get("/api/health")
async def health_check():
    try:
        from sqlalchemy import text
        from app.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {"status": "ok", "db": db_status}
