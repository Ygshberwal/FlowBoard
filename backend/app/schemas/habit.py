from __future__ import annotations
import uuid
from datetime import datetime, date
from typing import Optional, Dict, List
from pydantic import BaseModel, ConfigDict


class HabitBase(BaseModel):
    name: str
    color: str = "#1D9E75"
    category: Optional[str] = None
    sort_order: int = 0


class HabitCreate(HabitBase):
    pass


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None


class HabitOut(HabitBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    archived: bool
    created_at: datetime


class HabitLogToggle(BaseModel):
    date: date


class HabitStreakOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    habit_id: uuid.UUID
    current_streak: int
    longest_streak: int
    last_logged: Optional[date] = None
    updated_at: datetime


class HabitLogsResponse(BaseModel):
    logs: Dict[str, List[str]]


class HabitAnalyticsItem(BaseModel):
    habit_id: uuid.UUID
    name: str
    color: str
    completion_pct: float
    logged_days: int
    total_days: int


class HabitAnalyticsResponse(BaseModel):
    overall_pct: float
    habits: List[HabitAnalyticsItem]
