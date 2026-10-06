import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LearningPath(Base):
    __tablename__ = "learning_paths"

    learning_path_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LearningModule(Base):
    __tablename__ = "learning_modules"

    learning_module_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    learning_path_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("learning_paths.learning_path_id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)


class LearningTask(Base):
    __tablename__ = "learning_tasks"

    learning_task_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    learning_module_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learning_modules.learning_module_id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    resource_url: Mapped[str | None] = mapped_column(Text)
    estimated_hours: Mapped[float | None] = mapped_column(Numeric(5, 1))
    position: Mapped[int] = mapped_column(Integer)


class LearningPathEnrollment(Base):
    """One active learning path per researcher (user_id is the PK)."""

    __tablename__ = "learning_path_enrollments"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    learning_path_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("learning_paths.learning_path_id", ondelete="CASCADE"))
    enrollment_version: Mapped[int] = mapped_column(Integer, default=1)
    assigned_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    target_date: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LearningTaskCompletion(Base):
    __tablename__ = "learning_task_completions"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    learning_task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learning_tasks.learning_task_id", ondelete="CASCADE"), primary_key=True
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
