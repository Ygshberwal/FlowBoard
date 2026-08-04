from __future__ import annotations
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

from app.schemas.task import TaskOut


class SectionCreate(BaseModel):
    name: str
    position: Optional[int] = None


class SectionUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[int] = None


class SectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    position: int
    created_at: datetime


class SectionWithTasks(SectionOut):
    tasks: List[TaskOut] = []
