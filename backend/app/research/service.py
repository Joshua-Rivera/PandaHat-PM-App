"""Business rules for projects and tasks.

Every write follows the same shape:
    validate → authorize → change rows → COMMIT → emit notification events
Notifications are emitted only after the commit, through emit_notification_event,
which never raises: a notification bug can't undo a task assignment.

Services raise app.errors.* (never HTTPException) so they stay usable from
scripts, jobs and tests without FastAPI.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.errors import ConflictError, InvalidInputError, NotFoundError, PermissionDeniedError
from app.notifications import (
    DeadlineChangedEvent,
    NotificationEvent,
    ProjectAssignedEvent,
    ProjectRemovedEvent,
    TaskAssignedEvent,
    TaskUnassignedEvent,
    emit_notification_event,
)
from app.research import repository as repo
from app.research.domain import OPEN_TASK_STATUSES, TaskSource, TaskStatus
from app.research.models import Project, ProjectMember, Task
from app.research.schemas import (
    ActivityItemOut,
    ProjectCreate,
    ProjectDetailOut,
    ProjectMemberOut,
    ProjectStats,
    ProjectSummaryOut,
    ProjectUpdate,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)
from app.users.models import User
from app.users.schemas import UserRef


def _emit_all(events: list[NotificationEvent]) -> None:
    for event in events:
        emit_notification_event(event, SessionLocal)


def _require_manager(actor: User, action: str) -> None:
    if not actor.is_manager:
        raise PermissionDeniedError(f"Only project managers can {action}")


def _require_active_user(db: Session, user_id: uuid.UUID, field: str) -> User:
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise InvalidInputError("Choose an active team member", field=field)
    return user


def _ref(user: User | None) -> UserRef | None:
    return UserRef.model_validate(user) if user else None


# ── Projects ────────────────────────────────────────────────────────────────


def _get_project(db: Session, project_id: uuid.UUID) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise NotFoundError("Project not found")
    return project


def _get_visible_project(db: Session, viewer: User, project_id: uuid.UUID) -> Project:
    project = _get_project(db, project_id)
    if not viewer.is_manager and not repo.is_active_member(db, project_id, viewer.user_id):
        raise NotFoundError("Project not found")  # 404, not 403: don't reveal it exists
    return project


def _summary(project: Project, stats: ProjectStats, users: dict[uuid.UUID, User]) -> ProjectSummaryOut:
    return ProjectSummaryOut(
        project_id=project.project_id,
        name=project.name,
        description=project.description,
        research_track=project.research_track,
        stage=project.stage,
        target_date=project.target_date,
        is_archived=project.is_archived,
        project_manager=_ref(users.get(project.project_manager_user_id)),
        stats=stats,
    )


def summarize_projects(db: Session, projects: list[Project]) -> list[ProjectSummaryOut]:
    stats = repo.project_stats(db, [p.project_id for p in projects])
    users = repo.users_by_id(db, {p.project_manager_user_id for p in projects})
    return [_summary(p, stats[p.project_id], users) for p in projects]


def list_projects(db: Session, viewer: User, *, include_archived: bool = False) -> list[ProjectSummaryOut]:
    projects = list(db.scalars(repo.visible_projects_query(viewer, include_archived=include_archived)))
    return summarize_projects(db, projects)


def get_project_detail(db: Session, viewer: User, project_id: uuid.UUID) -> ProjectDetailOut:
    project = _get_visible_project(db, viewer, project_id)
    stats = repo.project_stats(db, [project_id])[project_id]
    users = repo.users_by_id(db, {project.project_manager_user_id, project.research_lead_user_id})
    member_rows = db.execute(
        select(ProjectMember, User)
        .join(User, User.user_id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id, ProjectMember.removed_at.is_(None))
        .order_by(func.lower(User.display_name))
    ).all()
    open_in_project = dict(
        db.execute(
            select(Task.assignee_user_id, func.count())
            .where(Task.project_id == project_id, Task.status.in_(OPEN_TASK_STATUSES), Task.is_archived.is_(False))
            .group_by(Task.assignee_user_id)
        ).all()
    )
    return ProjectDetailOut(
        **_summary(project, stats, users).model_dump(),
        research_question=project.research_question,
        hypothesis=project.hypothesis,
        research_lead=_ref(users.get(project.research_lead_user_id)),
        start_date=project.start_date,
        github_repository=project.github_repository,
        github_project_url=project.github_project_url,
        created_at=project.created_at,
        members=[
            ProjectMemberOut(
                user_id=user.user_id,
                display_name=user.display_name,
                research_status=user.research_status,
                commitment=user.commitment,
                open_task_count=open_in_project.get(user.user_id, 0),
                added_at=member.added_at,
            )
            for member, user in member_rows
        ],
        viewer_can_manage=viewer.is_manager,
    )


def _ensure_unique_project_name(db: Session, name: str, *, exclude: uuid.UUID | None = None) -> None:
    stmt = select(Project.project_id).where(func.lower(Project.name) == name.lower())
    if exclude is not None:
        stmt = stmt.where(Project.project_id != exclude)
    if db.scalar(stmt) is not None:
        raise ConflictError("A project with this name already exists", field="name")


def _validate_project_people(db: Session, pm_id: uuid.UUID | None, lead_id: uuid.UUID | None) -> None:
    if pm_id is not None:
        pm = _require_active_user(db, pm_id, "project_manager_user_id")
        if not pm.is_manager:
            raise InvalidInputError("The project manager must have the Project Manager role", field="project_manager_user_id")
    if lead_id is not None:
        _require_active_user(db, lead_id, "research_lead_user_id")


def create_project(db: Session, actor: User, data: ProjectCreate) -> ProjectDetailOut:
    _require_manager(actor, "create projects")
    _ensure_unique_project_name(db, data.name)
    _validate_project_people(db, data.project_manager_user_id, data.research_lead_user_id)
    fields = data.model_dump()
    if fields["project_manager_user_id"] is None:
        fields["project_manager_user_id"] = actor.user_id  # sensible default: whoever created it
    project = Project(project_id=uuid.uuid4(), created_by_user_id=actor.user_id, **fields)
    db.add(project)
    db.commit()
    return get_project_detail(db, actor, project.project_id)


def update_project(db: Session, actor: User, project_id: uuid.UUID, data: ProjectUpdate) -> ProjectDetailOut:
    _require_manager(actor, "edit projects")
    project = _get_project(db, project_id)
    changes = data.model_dump(exclude_unset=True)
    for required in ("name", "stage", "is_archived"):
        if required in changes and changes[required] is None:
            raise InvalidInputError(f"{required.replace('_', ' ').capitalize()} cannot be empty", field=required)
    if "name" in changes:
        _ensure_unique_project_name(db, changes["name"], exclude=project_id)
    _validate_project_people(db, changes.get("project_manager_user_id"), changes.get("research_lead_user_id"))
    start = changes.get("start_date", project.start_date)
    target = changes.get("target_date", project.target_date)
    if start and target and target < start:
        raise InvalidInputError("Target date must be on or after the start date", field="target_date")
    for key, value in changes.items():
        setattr(project, key, value)
    db.commit()
    return get_project_detail(db, actor, project_id)


def _ensure_member(db: Session, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectMember | None:
    """Add (or re-activate) membership. Returns the row if it changed, else None. Does not commit."""
    member = db.get(ProjectMember, (project_id, user_id))
    if member is None:
        member = ProjectMember(project_id=project_id, user_id=user_id, membership_version=1)
        db.add(member)
        return member
    if member.removed_at is not None:
        member.removed_at = None
        member.added_at = datetime.now(UTC)
        member.membership_version += 1
        return member
    return None


def add_project_member(db: Session, actor: User, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectDetailOut:
    _require_manager(actor, "add researchers to projects")
    project = _get_project(db, project_id)
    _require_active_user(db, user_id, "user_id")
    member = _ensure_member(db, project_id, user_id)
    db.commit()
    if member is not None:
        _emit_all([
            ProjectAssignedEvent(
                actor_user_id=actor.user_id,
                project_id=project_id,
                project_name=project.name,
                member_user_id=user_id,
                membership_version=member.membership_version,
            )
        ])
    return get_project_detail(db, actor, project_id)


def remove_project_member(db: Session, actor: User, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectDetailOut:
    _require_manager(actor, "remove researchers from projects")
    project = _get_project(db, project_id)
    member = db.get(ProjectMember, (project_id, user_id))
    if member is None or member.removed_at is not None:
        raise NotFoundError("That researcher is not on this project")
    open_tasks = db.scalar(
        select(func.count()).where(
            Task.project_id == project_id,
            Task.assignee_user_id == user_id,
            Task.status.in_(OPEN_TASK_STATUSES),
            Task.is_archived.is_(False),
        )
    )
    if open_tasks:
        raise ConflictError(f"Reassign their {open_tasks} open task(s) on this project first")
    member.removed_at = datetime.now(UTC)
    db.commit()
    _emit_all([
        ProjectRemovedEvent(
            actor_user_id=actor.user_id,
            project_id=project_id,
            project_name=project.name,
            member_user_id=user_id,
            membership_version=member.membership_version,
        )
    ])
    return get_project_detail(db, actor, project_id)


def recent_activity(db: Session, project_ids: list[uuid.UUID] | None, *, limit: int = 15) -> list[ActivityItemOut]:
    """A read-only activity feed derived from timestamps we already store."""
    stmt = select(Task, Project.name).join(Project, Project.project_id == Task.project_id).where(Task.is_archived.is_(False))
    project_stmt = select(Project)
    if project_ids is not None:
        stmt = stmt.where(Task.project_id.in_(project_ids))
        project_stmt = project_stmt.where(Project.project_id.in_(project_ids))
    rows = db.execute(stmt.order_by(func.greatest(Task.created_at, func.coalesce(Task.completed_at, Task.created_at)).desc()).limit(limit * 2)).all()
    users = repo.users_by_id(db, {t.assignee_user_id for t, _ in rows})
    items: list[ActivityItemOut] = []
    for task, project_name in rows:
        link = f"/projects/{task.project_id}/tasks/{task.task_id}"
        items.append(ActivityItemOut(occurred_at=task.created_at, kind="task_created", text=f"Task created: {task.title} · {project_name}", link=link))
        if task.completed_at:
            who = users.get(task.assignee_user_id)
            by = f" by {who.display_name}" if who else ""
            items.append(ActivityItemOut(occurred_at=task.completed_at, kind="task_completed", text=f"Completed{by}: {task.title}", link=link))
    for project in db.scalars(project_stmt.order_by(Project.created_at.desc()).limit(limit)):
        items.append(ActivityItemOut(occurred_at=project.created_at, kind="project_created", text=f"Project created: {project.name}", link=f"/projects/{project.project_id}"))
    items.sort(key=lambda i: i.occurred_at, reverse=True)
    return items[:limit]


def project_activity(db: Session, viewer: User, project_id: uuid.UUID) -> list[ActivityItemOut]:
    _get_visible_project(db, viewer, project_id)
    return recent_activity(db, [project_id])


# ── Tasks ───────────────────────────────────────────────────────────────────


def task_outs(db: Session, viewer: User, rows: list[tuple[Task, str]]) -> list[TaskOut]:
    users = repo.users_by_id(db, {t.assignee_user_id for t, _ in rows})
    now = datetime.now(UTC)
    return [
        TaskOut(
            task_id=t.task_id,
            project_id=t.project_id,
            project_name=project_name,
            title=t.title,
            description=t.description,
            status=t.status,
            priority=t.priority,
            source=t.source,
            github_issue_url=t.github_issue_url,
            estimated_hours=float(t.estimated_hours) if t.estimated_hours is not None else None,
            deadline_at=t.deadline_at,
            required_skills=t.required_skills or [],
            assignee=_ref(users.get(t.assignee_user_id)),
            assignee_user_id=t.assignee_user_id,
            assignment_version=t.assignment_version,
            is_archived=t.is_archived,
            is_overdue=t.status in OPEN_TASK_STATUSES and t.deadline_at is not None and t.deadline_at < now,
            created_at=t.created_at,
            updated_at=t.updated_at,
            completed_at=t.completed_at,
            viewer_can_manage=viewer.is_manager,
            viewer_can_update_status=viewer.is_manager or t.assignee_user_id == viewer.user_id,
        )
        for t, project_name in rows
    ]


def list_tasks(
    db: Session,
    viewer: User,
    *,
    project_id: uuid.UUID | None = None,
    assignee_user_id: uuid.UUID | None = None,
    statuses: list[TaskStatus] | None = None,
    include_archived: bool = False,
) -> list[TaskOut]:
    stmt = repo.task_query(
        viewer,
        project_id=project_id,
        assignee_user_id=assignee_user_id,
        statuses=statuses,
        include_archived=include_archived,
    )
    return task_outs(db, viewer, [tuple(r) for r in db.execute(stmt).all()])


def _get_visible_task(db: Session, viewer: User, task_id: uuid.UUID) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise NotFoundError("Task not found")
    if not viewer.is_manager and task.assignee_user_id != viewer.user_id and not repo.is_active_member(
        db, task.project_id, viewer.user_id
    ):
        raise NotFoundError("Task not found")
    return task


def get_task(db: Session, viewer: User, task_id: uuid.UUID) -> TaskOut:
    task = _get_visible_task(db, viewer, task_id)
    project = db.get(Project, task.project_id)
    return task_outs(db, viewer, [(task, project.name)])[0]


def _apply_status(task: Task, status: TaskStatus) -> None:
    if status == task.status:
        return
    task.status = status
    task.completed_at = datetime.now(UTC) if status == TaskStatus.COMPLETED else None


def _apply_github_link(task: Task, url: str | None) -> None:
    task.github_issue_url = url
    task.source = TaskSource.GITHUB_LINKED if url else TaskSource.LOCAL


def _assignment_events(
    actor: User, task: Task, project: Project, previous_assignee: uuid.UUID | None
) -> list[NotificationEvent]:
    common = dict(
        actor_user_id=actor.user_id,
        task_id=task.task_id,
        task_title=task.title,
        project_id=project.project_id,
        project_name=project.name,
        assignment_version=task.assignment_version,
    )
    events: list[NotificationEvent] = []
    if previous_assignee is not None:
        events.append(TaskUnassignedEvent(previous_assignee_user_id=previous_assignee, **common))
    if task.assignee_user_id is not None:
        events.append(TaskAssignedEvent(assignee_user_id=task.assignee_user_id, deadline_at=task.deadline_at, **common))
    return events


def _change_assignee(db: Session, task: Task, assignee_user_id: uuid.UUID | None) -> bool:
    """Returns True if the assignee actually changed. Does not commit."""
    if assignee_user_id == task.assignee_user_id:
        return False  # idempotent: same person again changes nothing and emits nothing
    if assignee_user_id is not None:
        _require_active_user(db, assignee_user_id, "assignee_user_id")
        # Assigning work on a project makes you a member of it (silently: the
        # TASK_ASSIGNED notification already tells them which project).
        _ensure_member(db, task.project_id, assignee_user_id)
    task.assignee_user_id = assignee_user_id
    task.assignment_version += 1
    return True


def create_task(db: Session, actor: User, data: TaskCreate) -> TaskOut:
    _require_manager(actor, "create tasks")
    project = db.get(Project, data.project_id)
    if project is None:
        raise InvalidInputError("Choose a project", field="project_id")
    if project.is_archived:
        raise InvalidInputError("This project is archived", field="project_id")
    task = Task(
        task_id=uuid.uuid4(),
        project_id=project.project_id,
        title=data.title,
        description=data.description,
        priority=data.priority,
        estimated_hours=data.estimated_hours,
        deadline_at=data.deadline_at,
        required_skills=data.required_skills,
        created_by_user_id=actor.user_id,
        assignment_version=0,
        status=TaskStatus.TODO,
    )
    _apply_status(task, data.status)
    _apply_github_link(task, data.github_issue_url)
    db.add(task)
    db.flush()
    _change_assignee(db, task, data.assignee_user_id)
    db.commit()
    _emit_all(_assignment_events(actor, task, project, previous_assignee=None))
    return get_task(db, actor, task.task_id)


ASSIGNEE_EDITABLE_FIELDS = {"status"}


def update_task(db: Session, actor: User, task_id: uuid.UUID, data: TaskUpdate) -> TaskOut:
    task = _get_visible_task(db, actor, task_id)
    changes = data.model_dump(exclude_unset=True)

    if not actor.is_manager:
        if task.assignee_user_id != actor.user_id:
            raise PermissionDeniedError("You can only update tasks assigned to you")
        forbidden = set(changes) - ASSIGNEE_EDITABLE_FIELDS
        if forbidden:
            raise PermissionDeniedError(f"Only project managers can change: {', '.join(sorted(forbidden))}")
        new_status = changes.get("status")
        if new_status is not None and new_status != task.status and TaskStatus.COMPLETED in (new_status, task.status):
            raise PermissionDeniedError("Only project managers can mark a task completed or reopen it")

    for required in ("title", "project_id", "status", "priority", "required_skills"):
        if required in changes and changes[required] is None:
            raise InvalidInputError(f"{required.replace('_', ' ').capitalize()} cannot be empty", field=required)

    if "project_id" in changes and changes["project_id"] != task.project_id:
        new_project = db.get(Project, changes["project_id"])
        if new_project is None or new_project.is_archived:
            raise InvalidInputError("Choose an active project", field="project_id")
        task.project_id = new_project.project_id
        if task.assignee_user_id is not None and "assignee_user_id" not in changes:
            _ensure_member(db, task.project_id, task.assignee_user_id)

    previous_assignee = task.assignee_user_id
    previous_deadline = task.deadline_at
    assignee_changed = "assignee_user_id" in changes and _change_assignee(db, task, changes["assignee_user_id"])

    for key in ("title", "description", "priority", "estimated_hours", "deadline_at", "required_skills"):
        if key in changes:
            setattr(task, key, changes[key])
    if "status" in changes:
        _apply_status(task, changes["status"])
    if "github_issue_url" in changes:
        _apply_github_link(task, changes["github_issue_url"])
    db.commit()

    project = db.get(Project, task.project_id)
    events: list[NotificationEvent] = []
    if assignee_changed:
        events += _assignment_events(actor, task, project, previous_assignee)
    elif "deadline_at" in changes and task.assignee_user_id is not None and task.deadline_at != previous_deadline:
        events.append(
            DeadlineChangedEvent(
                actor_user_id=actor.user_id,
                task_id=task.task_id,
                task_title=task.title,
                project_id=project.project_id,
                assignee_user_id=task.assignee_user_id,
                deadline_at=task.deadline_at,
            )
        )
    _emit_all(events)
    return get_task(db, actor, task_id)


def set_task_assignee(db: Session, actor: User, task_id: uuid.UUID, assignee_user_id: uuid.UUID | None) -> TaskOut:
    _require_manager(actor, "assign tasks")
    task = db.get(Task, task_id)
    if task is None:
        raise NotFoundError("Task not found")
    previous_assignee = task.assignee_user_id
    if _change_assignee(db, task, assignee_user_id):
        db.commit()
        _emit_all(_assignment_events(actor, task, db.get(Project, task.project_id), previous_assignee))
    return get_task(db, actor, task_id)


def archive_task(db: Session, actor: User, task_id: uuid.UUID) -> None:
    """Soft delete: archived tasks drop out of lists and workload but keep history."""
    _require_manager(actor, "archive tasks")
    task = db.get(Task, task_id)
    if task is None:
        raise NotFoundError("Task not found")
    task.is_archived = True
    db.commit()
