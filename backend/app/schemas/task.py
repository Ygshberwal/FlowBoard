from __future__ import annotations
import uuid
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class TaskCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    author_name: str
    body: str
    created_at: datetime


class TaskCommentCreate(BaseModel):
    author_name: str = "You"
    body: str


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "pending"
    priority: str = "medium"
    category: Optional[str] = None
    estimated_mins: Optional[int] = None
    deadline: Optional[datetime] = None
    scheduled_for: Optional[date] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    estimated_mins: Optional[int] = None
    deadline: Optional[datetime] = None
    scheduled_for: Optional[date] = None
    done: Optional[bool] = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    done: bool
    created_at: datetime
    updated_at: datetime
    comments: List[TaskCommentOut] = []


class TaskCounts(BaseModel):
    today: int = 0
    week: int = 0
    ongoing: int = 0
    pending: int = 0
    freetime: int = 0
