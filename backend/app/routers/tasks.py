import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.task import TaskOut, TaskCreate, TaskUpdate, TaskCommentCreate, TaskCommentOut, TaskCounts
from app.services import task_service

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/counts", response_model=TaskCounts)
async def task_counts(db: AsyncSession = Depends(get_db)):
    return await task_service.get_task_counts(db)


@router.get("", response_model=List[TaskOut])
async def list_tasks(
    view: Optional[str] = Query(None),
    section_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if section_id is not None:
        return await task_service.get_tasks_by_section(db, section_id)
    if view is not None:
        return await task_service.get_tasks_by_view(db, view)
    return await task_service.get_all_tasks(db)


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(data: TaskCreate, db: AsyncSession = Depends(get_db)):
    return await task_service.create_task(db, data)


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    task = await task_service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID, data: TaskUpdate, db: AsyncSession = Depends(get_db)
):
    task = await task_service.update_task(db, task_id, data)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    deleted = await task_service.delete_task(db, task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")


@router.patch("/{task_id}/toggle", response_model=TaskOut)
async def toggle_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    task = await task_service.toggle_task_done(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/{task_id}/comments", response_model=TaskCommentOut, status_code=201)
async def add_comment(
    task_id: uuid.UUID,
    data: TaskCommentCreate,
    db: AsyncSession = Depends(get_db),
):
    comment = await task_service.add_comment(db, task_id, data.author_name, data.body)
    if not comment:
        raise HTTPException(status_code=404, detail="Task not found")
    return comment
