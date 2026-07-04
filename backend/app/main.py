import subprocess
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine
from app.redis_client import close_redis
from app.routers import tasks, habits, analytics

settings = get_settings()


def run_migrations():
    try:
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            cwd="/app",
        )
        if result.returncode != 0:
            print(f"Alembic error: {result.stderr}", file=sys.stderr)
        else:
            print("Migrations applied successfully.")
    except Exception as e:
        print(f"Migration failed: {e}", file=sys.stderr)


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    from app.seed import seed
    await seed()
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
