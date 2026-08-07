import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.habit import (
    HabitOut, HabitCreate, HabitUpdate,
    HabitLogToggle, HabitStreakOut, HabitLogsResponse
)
from app.services import habit_service

router = APIRouter(prefix="/api/habits", tags=["habits"])


@router.get("", response_model=List[HabitOut])
async def list_habits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await habit_service.get_habits(db, current_user.id)


@router.post("", response_model=HabitOut, status_code=201)
async def create_habit(
    data: HabitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await habit_service.create_habit(db, current_user.id, data)


@router.patch("/{habit_id}", response_model=HabitOut)
async def update_habit(
    habit_id: uuid.UUID,
    data: HabitUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    habit = await habit_service.update_habit(db, habit_id, current_user.id, data)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    return habit


@router.delete("/{habit_id}", status_code=204)
async def delete_habit(
    habit_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await habit_service.archive_habit(db, habit_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Habit not found")


@router.post("/{habit_id}/logs", status_code=200)
async def toggle_log(
    habit_id: uuid.UUID,
    data: HabitLogToggle,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import timezone, datetime
    today = datetime.now(timezone.utc).date()
    if data.date > today:
        raise HTTPException(status_code=400, detail="Cannot log a future date")
    logged = await habit_service.toggle_log(db, habit_id, current_user.id, data.date)
    if logged is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    return {"logged": logged, "date": data.date.isoformat()}


@router.get("/logs/year", response_model=HabitLogsResponse)
async def get_logs_year(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = await habit_service.get_logs_for_year(db, current_user.id, year)
    return HabitLogsResponse(logs=logs)


@router.get("/logs", response_model=HabitLogsResponse)
async def get_logs(
    year: int = Query(...),
    month: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = await habit_service.get_logs_for_month(db, current_user.id, year, month)
    return HabitLogsResponse(logs=logs)


@router.get("/streaks", response_model=List[HabitStreakOut])
async def get_streaks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await habit_service.get_streaks(db, current_user.id)
