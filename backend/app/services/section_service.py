from __future__ import annotations
import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.section import Section
from app.models.task import Task
from app.schemas.section import SectionCreate, SectionUpdate


async def list_sections(db: AsyncSession, user_id: uuid.UUID) -> List[Section]:
    result = await db.execute(
        select(Section)
        .where(Section.user_id == user_id)
        .order_by(Section.position, Section.created_at)
    )
    return list(result.scalars().all())


async def get_board(db: AsyncSession, user_id: uuid.UUID) -> List[Section]:
    result = await db.execute(
        select(Section)
        .where(Section.user_id == user_id)
        .options(selectinload(Section.tasks).selectinload(Task.comments))
        .order_by(Section.position, Section.created_at)
    )
    return list(result.scalars().all())


async def get_section(
    db: AsyncSession, section_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[Section]:
    result = await db.execute(
        select(Section).where(
            Section.id == section_id, Section.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def create_section(
    db: AsyncSession, user_id: uuid.UUID, data: SectionCreate
) -> Section:
    position = data.position
    if position is None:
        max_pos = await db.scalar(
            select(func.max(Section.position)).where(Section.user_id == user_id)
        )
        position = (max_pos + 1) if max_pos is not None else 0
    section = Section(
        user_id=user_id,
        name=data.name.strip() or "Untitled",
        position=position,
    )
    db.add(section)
    await db.flush()
    await db.refresh(section)
    return section


async def update_section(
    db: AsyncSession, section_id: uuid.UUID, user_id: uuid.UUID, data: SectionUpdate
) -> Optional[Section]:
    section = await get_section(db, section_id, user_id)
    if not section:
        return None
    values = data.model_dump(exclude_unset=True)
    if "name" in values and values["name"] is not None:
        section.name = values["name"].strip() or section.name
    if "position" in values and values["position"] is not None:
        section.position = values["position"]
    await db.flush()
    await db.refresh(section)
    return section


async def delete_section(
    db: AsyncSession, section_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    section = await get_section(db, section_id, user_id)
    if not section:
        return False
    await db.delete(section)
    return True


async def reorder_sections(
    db: AsyncSession, user_id: uuid.UUID, ordered_ids: List[uuid.UUID]
) -> List[Section]:
    for index, sid in enumerate(ordered_ids):
        section = await get_section(db, sid, user_id)
        if section:
            section.position = index
    await db.flush()
    return await list_sections(db, user_id)
