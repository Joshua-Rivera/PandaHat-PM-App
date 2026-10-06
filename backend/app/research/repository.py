"""Read queries for projects and tasks. Writes are simple ORM changes made by
the service; the aggregate queries that would be awkward in a service live here."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Select, case, func, or_, select
from sqlalchemy.orm import Session

from app.research.domain import OPEN_TASK_STATUSES, TaskStatus
from app.research.models import Project, ProjectMember, Task
from app.research.schemas import ProjectStats
from app.users.models import User


def active_member_project_ids(db: Session, user_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        db.scalars(
            select(ProjectMember.project_id).where(ProjectMember.user_id == user_id, ProjectMember.removed_at.is_(None))
        )
    )


def is_active_member(db: Session, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    member = db.get(ProjectMember, (project_id, user_id))
    return member is not None and member.removed_at is None


def project_stats(db: Session, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, ProjectStats]:
    if not project_ids:
        return {}
    now = datetime.now(UTC)
    is_open = Task.status.in_(OPEN_TASK_STATUSES)
    task_rows = db.execute(
        select(
            Task.project_id,
            func.count().filter(is_open).label("open"),
            func.count().filter(Task.status == TaskStatus.COMPLETED).label("completed"),
            func.count().filter(Task.status == TaskStatus.BLOCKED).label("blocked"),
            func.count().filter(is_open, Task.deadline_at < now).label("overdue"),
            func.min(case((is_open & (Task.deadline_at >= now), Task.deadline_at))).label("next_deadline"),
        )
        .where(Task.project_id.in_(project_ids), Task.is_archived.is_(False))
        .group_by(Task.project_id)
    )
    member_counts = dict(
        db.execute(
            select(ProjectMember.project_id, func.count())
            .where(ProjectMember.project_id.in_(project_ids), ProjectMember.removed_at.is_(None))
            .group_by(ProjectMember.project_id)
        ).all()
    )
    stats = {pid: ProjectStats(member_count=member_counts.get(pid, 0)) for pid in project_ids}
    for row in task_rows:
        total = row.open + row.completed
        stats[row.project_id] = ProjectStats(
            member_count=member_counts.get(row.project_id, 0),
            open_task_count=row.open,
            completed_task_count=row.completed,
            blocked_task_count=row.blocked,
            overdue_task_count=row.overdue,
            progress_percent=round(100 * row.completed / total) if total else 0,
            next_deadline_at=row.next_deadline,
        )
    return stats


def users_by_id(db: Session, user_ids: set[uuid.UUID | None]) -> dict[uuid.UUID, User]:
    ids = [u for u in user_ids if u is not None]
    if not ids:
        return {}
    return {u.user_id: u for u in db.scalars(select(User).where(User.user_id.in_(ids)))}


def visible_projects_query(viewer: User, *, include_archived: bool) -> Select:
    stmt = select(Project)
    if not include_archived:
        stmt = stmt.where(Project.is_archived.is_(False))
    if not viewer.is_manager:
        stmt = stmt.where(
            Project.project_id.in_(
                select(ProjectMember.project_id).where(
                    ProjectMember.user_id == viewer.user_id, ProjectMember.removed_at.is_(None)
                )
            )
        )
    return stmt.order_by(func.lower(Project.name))


def task_query(
    viewer: User,
    *,
    project_id: uuid.UUID | None = None,
    assignee_user_id: uuid.UUID | None = None,
    statuses: list[TaskStatus] | None = None,
    include_archived: bool = False,
) -> Select:
    stmt = select(Task, Project.name).join(Project, Project.project_id == Task.project_id)
    if not include_archived:
        stmt = stmt.where(Task.is_archived.is_(False))
    if project_id is not None:
        stmt = stmt.where(Task.project_id == project_id)
    if assignee_user_id is not None:
        stmt = stmt.where(Task.assignee_user_id == assignee_user_id)
    if statuses:
        stmt = stmt.where(Task.status.in_(statuses))
    if not viewer.is_manager:
        # Researchers see their own tasks plus tasks in projects they belong to.
        stmt = stmt.where(
            or_(
                Task.assignee_user_id == viewer.user_id,
                Task.project_id.in_(
                    select(ProjectMember.project_id).where(
                        ProjectMember.user_id == viewer.user_id, ProjectMember.removed_at.is_(None)
                    )
                ),
            )
        )
    # Open work first, soonest deadline first, undated last.
    return stmt.order_by(
        case((Task.status == TaskStatus.COMPLETED, 1), else_=0),
        Task.deadline_at.asc().nulls_last(),
        Task.created_at.desc(),
    )
