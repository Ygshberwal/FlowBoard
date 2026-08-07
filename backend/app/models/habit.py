import uuid
from datetime import datetime, date
from sqlalchemy import (
    Text, Boolean, Integer, DateTime, Date,
    ForeignKey, String, func, UniqueConstraint, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Habit(Base):
    __tablename__ = "habits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#1D9E75")
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    logs: Mapped[list["HabitLog"]] = relationship(
        "HabitLog", back_populates="habit", cascade="all, delete-orphan"
    )
    streak: Mapped["HabitStreak | None"] = relationship(
        "HabitStreak", back_populates="habit",
        cascade="all, delete-orphan", uselist=False
    )
    owner: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("ix_habits_user_id", "user_id"),
    )


class HabitLog(Base):
    __tablename__ = "habit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    habit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("habits.id", ondelete="CASCADE"),
        nullable=False,
    )
    logged_on: Mapped[date] = mapped_column(Date, nullable=False)

    habit: Mapped["Habit"] = relationship("Habit", back_populates="logs")

    __table_args__ = (
        UniqueConstraint("habit_id", "logged_on", name="uq_habit_log_day"),
        Index("ix_habit_logs_habit_date", "habit_id", "logged_on"),
    )


class HabitStreak(Base):
    __tablename__ = "habit_streaks"

    habit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("habits.id", ondelete="CASCADE"),
        primary_key=True,
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_logged: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    habit: Mapped["Habit"] = relationship("Habit", back_populates="streak")
