from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.schemas.habit import HabitAnalyticsResponse
from app.services import habit_service
from app.models.task import Task

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/habits", response_model=HabitAnalyticsResponse)
async def habit_analytics(
    year: int = Query(...),
    month: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    return await habit_service.get_habit_analytics(db, year, month)


@router.get("/tasks")
async def task_analytics(db: AsyncSession = Depends(get_db)):
    status_result = await db.execute(
        select(Task.status, func.count(Task.id).label("cnt"))
        .group_by(Task.status)
    )
    by_status = {row.status: row.cnt for row in status_result.all()}

    priority_result = await db.execute(
        select(Task.priority, func.count(Task.id).label("cnt"))
        .group_by(Task.priority)
    )
    by_priority = {row.priority: row.cnt for row in priority_result.all()}

    total = await db.scalar(select(func.count(Task.id)))
    done = await db.scalar(select(func.count(Task.id)).where(Task.done == True))

    return {
        "total": total or 0,
        "done": done or 0,
        "by_status": by_status,
        "by_priority": by_priority,
    }
