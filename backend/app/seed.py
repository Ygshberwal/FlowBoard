"""
Seed script — run once on startup if tables are empty.
Usage: python -m app.seed
"""
import asyncio
import uuid
from datetime import datetime, date, timedelta, timezone

from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models.task import Task
from app.models.section import Section
from app.models.habit import Habit, HabitStreak


DEFAULT_SECTIONS = [
    ("Today", 0),
    ("This week", 1),
    ("Ongoing", 2),
    ("Pending", 3),
    ("Free time", 4),
]

# Maps the legacy status on seed tasks to a default section name.
STATUS_TO_SECTION = {
    "today": "Today",
    "week": "This week",
    "ongoing": "Ongoing",
    "pending": "Pending",
    "freetime": "Free time",
}


HABITS = [
    {"name": "Wake up 6:30", "color": "#F97316", "sort_order": 0},
    {"name": "Drink water", "color": "#3B82F6", "sort_order": 1},
    {"name": "Read 10 pages", "color": "#8B5CF6", "sort_order": 2},
    {"name": "2 fruits", "color": "#22C55E", "sort_order": 3},
    {"name": "No smoke", "color": "#EF4444", "sort_order": 4},
    {"name": "Less phone", "color": "#F59E0B", "sort_order": 5},
    {"name": "Training", "color": "#1D9E75", "sort_order": 6},
    {"name": "Sleep by 23:00", "color": "#6366F1", "sort_order": 7},
]

now = datetime.now(timezone.utc)

TASKS = [
    {
        "title": "Plan weekly goals",
        "description": "Review last week and define top 3 priorities for the new week.",
        "status": "today",
        "priority": "high",
        "category": "Planning",
        "estimated_mins": 30,
        "scheduled_for": date.today(),
        "done": False,
    },
    {
        "title": "Morning workout routine",
        "description": "Complete 30 min HIIT session followed by stretching.",
        "status": "ongoing",
        "priority": "medium",
        "category": "Health",
        "estimated_mins": 45,
        "done": False,
    },
    {
        "title": "Read Clean Code chapter 5",
        "description": "Focus on formatting and naming conventions.",
        "status": "pending",
        "priority": "medium",
        "category": "Learning",
        "estimated_mins": 60,
        "done": False,
    },
    {
        "title": "Submit project report",
        "description": "Finalize the Q2 summary and send to team lead.",
        "status": "week",
        "priority": "high",
        "category": "Work",
        "estimated_mins": 90,
        "deadline": now + timedelta(days=3),
        "done": False,
    },
    {
        "title": "Watch documentary",
        "description": "Something relaxing — nature or science.",
        "status": "freetime",
        "priority": "low",
        "category": "Leisure",
        "estimated_mins": 90,
        "done": False,
    },
]


async def seed():
    async with AsyncSessionLocal() as session:
        habit_count = await session.scalar(select(func.count(Habit.id)))
        task_count = await session.scalar(select(func.count(Task.id)))
        section_count = await session.scalar(select(func.count(Section.id)))

        section_by_name: dict[str, Section] = {}
        if section_count == 0:
            print("Seeding sections...")
            for name, position in DEFAULT_SECTIONS:
                section = Section(id=uuid.uuid4(), name=name, position=position)
                session.add(section)
                section_by_name[name] = section
            await session.flush()
            print(f"  -> {len(DEFAULT_SECTIONS)} sections inserted.")
        else:
            existing = await session.execute(select(Section))
            for section in existing.scalars().all():
                section_by_name[section.name] = section

        if habit_count == 0:
            print("Seeding habits...")
            for h in HABITS:
                habit = Habit(id=uuid.uuid4(), **h)
                session.add(habit)
                await session.flush()
                streak = HabitStreak(habit_id=habit.id)
                session.add(streak)
            print(f"  → {len(HABITS)} habits inserted.")
        else:
            print(f"  Habits already exist ({habit_count}), skipping.")

        if task_count == 0:
            print("Seeding tasks...")
            for t in TASKS:
                section = section_by_name.get(STATUS_TO_SECTION.get(t["status"], ""))
                task = Task(id=uuid.uuid4(), section_id=section.id if section else None, **t)
                session.add(task)
            print(f"  → {len(TASKS)} tasks inserted.")
        else:
            print(f"  Tasks already exist ({task_count}), skipping.")

        await session.commit()
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
