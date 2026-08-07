import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.section import SectionOut, SectionCreate, SectionUpdate, SectionWithTasks
from app.services import section_service

router = APIRouter(prefix="/api/sections", tags=["sections"])


class ReorderPayload(BaseModel):
    ordered_ids: List[uuid.UUID]


@router.get("", response_model=List[SectionOut])
async def list_sections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await section_service.list_sections(db, current_user.id)


@router.get("/board", response_model=List[SectionWithTasks])
async def board(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await section_service.get_board(db, current_user.id)


@router.post("", response_model=SectionOut, status_code=201)
async def create_section(
    data: SectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await section_service.create_section(db, current_user.id, data)


@router.patch("/reorder", response_model=List[SectionOut])
async def reorder(
    payload: ReorderPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await section_service.reorder_sections(db, current_user.id, payload.ordered_ids)


@router.patch("/{section_id}", response_model=SectionOut)
async def update_section(
    section_id: uuid.UUID,
    data: SectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = await section_service.update_section(db, section_id, current_user.id, data)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


@router.delete("/{section_id}", status_code=204)
async def delete_section(
    section_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await section_service.delete_section(db, section_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Section not found")
