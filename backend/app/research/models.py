import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.research.domain import ProjectStage, TaskPriority, TaskSource, TaskStatus


class Project(Base):
    __tablename__ = "projects"

    project_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    research_question: Mapped[str] = mapped_column(Text, default="")
    hypothesis: Mapped[str] = mapped_column(Text, default="")
    research_track: Mapped[str] = mapped_column(Text, default="")
    stage: Mapped[str] = mapped_column(Text, default=ProjectStage.PLANNING)
    project_manager_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"))
    research_lead_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"))
    start_date: Mapped[date | None] = mapped_column(Date)
    target_date: Mapped[date | None] = mapped_column(Date)
    github_repository: Mapped[str | None] = mapped_column(Text)  # "owner/repo"
    github_project_url: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProjectMember(Base):
    """Membership is soft-removed (removed_at) so membership_version survives a re-add."""

    __tablename__ = "project_members"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.project_id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    membership_version: Mapped[int] = mapped_column(Integer, default=1)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Task(Base):
    __tablename__ = "tasks"

    task_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.project_id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    assignee_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"))
    # Incremented on every (re)assignment; part of the TASK_ASSIGNED dedupe key so
    # assign → unassign → assign again produces a *new* notification.
    assignment_version: Mapped[int] = mapped_column(Integer, default=0)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    estimated_hours: Mapped[float | None] = mapped_column(Numeric(5, 1))
    status: Mapped[str] = mapped_column(Text, default=TaskStatus.TODO)
    priority: Mapped[str] = mapped_column(Text, default=TaskPriority.MEDIUM)
    source: Mapped[str] = mapped_column(Text, default=TaskSource.LOCAL)
    github_issue_url: Mapped[str | None] = mapped_column(Text)
    required_skills: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
