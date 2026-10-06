"""The PM's view of people: Team list, researcher profile, workload."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.availability.service import get_availability
from app.db import SessionLocal
from app.errors import NotFoundError, PermissionDeniedError
from app.learning.service import get_learning_progress, learning_progress_refs
from app.notifications import ResearchReadyEvent, emit_notification_event
from app.research import service as research_service
from app.research.domain import TaskStatus
from app.research.models import Project, ProjectMember
from app.team.schemas import ResearcherDetailOut
from app.users.domain import AccessStatus, ResearchStatus, Role
from app.users.models import User
from app.users.schemas import ProjectRef, ResearcherSummaryOut, ResearcherUpdate, WorkloadOut
from app.users.workload import workloads_for


def _summaries(db: Session, users: list[User]) -> list[ResearcherSummaryOut]:
    ids = [u.user_id for u in users]
    workloads = workloads_for(db, ids)
    learning = learning_progress_refs(db, ids)
    projects: dict[uuid.UUID, list[ProjectRef]] = {i: [] for i in ids}
    for user_id, project_id, name in db.execute(
        select(ProjectMember.user_id, Project.project_id, Project.name)
        .join(Project, Project.project_id == ProjectMember.project_id)
        .where(ProjectMember.user_id.in_(ids), ProjectMember.removed_at.is_(None), Project.is_archived.is_(False))
        .order_by(func.lower(Project.name))
    ):
        projects[user_id].append(ProjectRef(project_id=project_id, name=name))
    return [
        ResearcherSummaryOut(
            user_id=u.user_id,
            display_name=u.display_name,
            email=u.email,
            role=u.role,
            research_status=u.research_status,
            commitment=u.commitment,
            skills=u.skills or [],
            workload=WorkloadOut.of(workloads[u.user_id]),
            projects=projects[u.user_id],
            learning=learning.get(u.user_id),
        )
        for u in users
    ]


def list_researchers(db: Session, actor: User) -> list[ResearcherSummaryOut]:
    if not actor.is_manager:
        raise PermissionDeniedError("Only project managers can view the team")
    users = list(
        db.scalars(
            select(User)
            .where(User.role == Role.RESEARCHER, User.is_active.is_(True), User.access_status == AccessStatus.APPROVED)
            .order_by(func.lower(User.display_name))
        )
    )
    return _summaries(db, users)


def _get_researcher(db: Session, viewer: User, user_id: uuid.UUID) -> User:
    if not viewer.is_manager and viewer.user_id != user_id:
        raise NotFoundError("Researcher not found")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise NotFoundError("Researcher not found")
    return user


def get_researcher_detail(db: Session, viewer: User, user_id: uuid.UUID) -> ResearcherDetailOut:
    user = _get_researcher(db, viewer, user_id)
    [summary] = _summaries(db, [user])
    tasks = research_service.list_tasks(db, viewer, assignee_user_id=user_id)
    project_ids = [p.project_id for p in summary.projects]
    projects = list(db.scalars(select(Project).where(Project.project_id.in_(project_ids)).order_by(func.lower(Project.name))))
    completed = [t for t in tasks if t.status == TaskStatus.COMPLETED]
    completed.sort(key=lambda t: t.completed_at, reverse=True)
    return ResearcherDetailOut(
        researcher=summary,
        availability=get_availability(db, user_id),
        open_tasks=[t for t in tasks if t.status != TaskStatus.COMPLETED],
        recently_completed_tasks=completed[:5],
        projects=research_service.summarize_projects(db, projects),
        learning=get_learning_progress(db, user_id),
        viewer_can_manage=viewer.is_manager,
    )


def update_researcher(db: Session, actor: User, user_id: uuid.UUID, data: ResearcherUpdate) -> ResearcherDetailOut:
    if not actor.is_manager:
        raise PermissionDeniedError("Only project managers can update researcher profiles")
    user = _get_researcher(db, actor, user_id)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    became_ready = (
        changes.get("research_status") == ResearchStatus.RESEARCH
        and user.research_status != ResearchStatus.RESEARCH
    )
    for key, value in changes.items():
        setattr(user, key, value)
    db.commit()
    if became_ready:
        emit_notification_event(ResearchReadyEvent(actor_user_id=actor.user_id, researcher_user_id=user_id), SessionLocal)
    return get_researcher_detail(db, actor, user_id)
