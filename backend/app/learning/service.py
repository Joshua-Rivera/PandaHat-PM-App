"""Learning paths: PMs build path → modules → tasks; researchers work through
them; finishing a path tells the PMs so they can move the researcher to Research."""

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.errors import ConflictError, InvalidInputError, NotFoundError, PermissionDeniedError
from app.learning.models import (
    LearningModule,
    LearningPath,
    LearningPathEnrollment,
    LearningTask,
    LearningTaskCompletion,
)
from app.learning.schemas import (
    CurrentLearningTaskOut,
    LearningEnrollmentOut,
    LearningModuleOut,
    LearningPathCreate,
    LearningPathDetailOut,
    LearningPathListItem,
    LearningProgressOut,
    LearningTaskOut,
    ModuleState,
    MyLearningPathOut,
)
from app.notifications import LearningPathAssignedEvent, LearningPathCompletedEvent, emit_notification_event
from app.users.domain import MANAGER_ROLES
from app.users.models import User
from app.users.schemas import LearningProgressRef, UserRef


@dataclass
class _Structure:
    path: LearningPath
    modules: list[LearningModule]
    tasks_by_module: dict[uuid.UUID, list[LearningTask]]

    @property
    def all_tasks(self) -> list[LearningTask]:
        return [t for m in self.modules for t in self.tasks_by_module[m.learning_module_id]]


def _require_manager(actor: User) -> None:
    if not actor.is_manager:
        raise PermissionDeniedError("Only project managers can manage learning paths")


def _load(db: Session, learning_path_id: uuid.UUID) -> _Structure:
    path = db.get(LearningPath, learning_path_id)
    if path is None:
        raise NotFoundError("Learning path not found")
    modules = list(
        db.scalars(
            select(LearningModule).where(LearningModule.learning_path_id == learning_path_id).order_by(LearningModule.position)
        )
    )
    tasks_by_module: dict[uuid.UUID, list[LearningTask]] = defaultdict(list)
    for task in db.scalars(
        select(LearningTask)
        .where(LearningTask.learning_module_id.in_([m.learning_module_id for m in modules]))
        .order_by(LearningTask.position)
    ):
        tasks_by_module[task.learning_module_id].append(task)
    return _Structure(path, modules, tasks_by_module)


def _completions(db: Session, user_id: uuid.UUID | None, task_ids: list[uuid.UUID]) -> dict[uuid.UUID, datetime]:
    if user_id is None or not task_ids:
        return {}
    return dict(
        db.execute(
            select(LearningTaskCompletion.learning_task_id, LearningTaskCompletion.completed_at).where(
                LearningTaskCompletion.user_id == user_id, LearningTaskCompletion.learning_task_id.in_(task_ids)
            )
        ).all()
    )


def _task_out(task: LearningTask, done: dict[uuid.UUID, datetime]) -> LearningTaskOut:
    return LearningTaskOut(
        learning_task_id=task.learning_task_id,
        title=task.title,
        description=task.description,
        resource_url=task.resource_url,
        estimated_hours=float(task.estimated_hours) if task.estimated_hours is not None else None,
        is_completed=task.learning_task_id in done,
        completed_at=done.get(task.learning_task_id),
    )


def _modules_out(structure: _Structure, done: dict[uuid.UUID, datetime]) -> list[LearningModuleOut]:
    out = []
    for module in structure.modules:
        tasks = [_task_out(t, done) for t in structure.tasks_by_module[module.learning_module_id]]
        completed = sum(t.is_completed for t in tasks)
        state = (
            ModuleState.COMPLETED
            if tasks and completed == len(tasks)
            else ModuleState.IN_PROGRESS
            if completed
            else ModuleState.NOT_STARTED
        )
        out.append(
            LearningModuleOut(
                learning_module_id=module.learning_module_id,
                title=module.title,
                position=module.position,
                tasks=tasks,
                completed_task_count=completed,
                total_task_count=len(tasks),
                state=state,
            )
        )
    return out


def _progress(db: Session, enrollment: LearningPathEnrollment) -> LearningProgressOut:
    structure = _load(db, enrollment.learning_path_id)
    task_ids = [t.learning_task_id for t in structure.all_tasks]
    done = _completions(db, enrollment.user_id, task_ids)
    modules = _modules_out(structure, done)
    current = None
    for module in modules:
        nxt = next((t for t in module.tasks if not t.is_completed), None)
        if nxt:
            current = CurrentLearningTaskOut(**nxt.model_dump(), module_title=module.title)
            break
    total = len(task_ids)
    completed = len(done)
    return LearningProgressOut(
        learning_path_id=structure.path.learning_path_id,
        name=structure.path.name,
        description=structure.path.description,
        modules=modules,
        completed_task_count=completed,
        total_task_count=total,
        progress_percent=round(100 * completed / total) if total else 0,
        current_task=current,
        target_date=enrollment.target_date,
        assigned_at=enrollment.assigned_at,
        completed_at=enrollment.completed_at,
    )


def get_learning_progress(db: Session, user_id: uuid.UUID) -> LearningProgressOut | None:
    enrollment = db.get(LearningPathEnrollment, user_id)
    return _progress(db, enrollment) if enrollment else None


def get_my_learning_path(db: Session, user: User) -> MyLearningPathOut:
    return MyLearningPathOut(enrollment=get_learning_progress(db, user.user_id))


def set_my_task_completion(db: Session, user: User, learning_task_id: uuid.UUID, is_completed: bool) -> MyLearningPathOut:
    enrollment = db.get(LearningPathEnrollment, user.user_id)
    if enrollment is None:
        raise NotFoundError("You don't have a learning path yet")
    structure = _load(db, enrollment.learning_path_id)
    task_ids = [t.learning_task_id for t in structure.all_tasks]
    if learning_task_id not in task_ids:
        raise NotFoundError("That task is not part of your learning path")

    if is_completed:
        db.execute(
            insert(LearningTaskCompletion)
            .values(user_id=user.user_id, learning_task_id=learning_task_id)
            .on_conflict_do_nothing()  # completing twice keeps the first completion time
        )
    else:
        db.execute(
            delete(LearningTaskCompletion).where(
                LearningTaskCompletion.user_id == user.user_id,
                LearningTaskCompletion.learning_task_id == learning_task_id,
            )
        )
    completed_count = len(_completions(db, user.user_id, task_ids))
    just_finished = completed_count == len(task_ids) and enrollment.completed_at is None
    if just_finished:
        enrollment.completed_at = datetime.now(UTC)
    elif completed_count < len(task_ids):
        enrollment.completed_at = None
    db.commit()

    if just_finished:
        managers = list(db.scalars(select(User.user_id).where(User.role.in_(MANAGER_ROLES), User.is_active.is_(True))))
        emit_notification_event(
            LearningPathCompletedEvent(
                actor_user_id=user.user_id,
                learning_path_id=structure.path.learning_path_id,
                learning_path_name=structure.path.name,
                researcher_user_id=user.user_id,
                researcher_name=user.display_name,
                manager_user_ids=managers,
                enrollment_version=enrollment.enrollment_version,
            ),
            SessionLocal,
        )
    return get_my_learning_path(db, user)


def learning_progress_refs(db: Session, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, LearningProgressRef]:
    """Compact progress for many researchers at once (Team list)."""
    if not user_ids:
        return {}
    enrollments = db.execute(
        select(LearningPathEnrollment, LearningPath.name)
        .join(LearningPath, LearningPath.learning_path_id == LearningPathEnrollment.learning_path_id)
        .where(LearningPathEnrollment.user_id.in_(user_ids))
    ).all()
    path_ids = {e.learning_path_id for e, _ in enrollments}
    totals = dict(
        db.execute(
            select(LearningModule.learning_path_id, func.count(LearningTask.learning_task_id))
            .join(LearningTask, LearningTask.learning_module_id == LearningModule.learning_module_id)
            .where(LearningModule.learning_path_id.in_(path_ids))
            .group_by(LearningModule.learning_path_id)
        ).all()
    )
    done = {
        (row.user_id, row.learning_path_id): row.n
        for row in db.execute(
            select(
                LearningTaskCompletion.user_id,
                LearningModule.learning_path_id,
                func.count().label("n"),
            )
            .join(LearningTask, LearningTask.learning_task_id == LearningTaskCompletion.learning_task_id)
            .join(LearningModule, LearningModule.learning_module_id == LearningTask.learning_module_id)
            .where(LearningTaskCompletion.user_id.in_(user_ids), LearningModule.learning_path_id.in_(path_ids))
            .group_by(LearningTaskCompletion.user_id, LearningModule.learning_path_id)
        )
    }
    result = {}
    for enrollment, name in enrollments:
        total = totals.get(enrollment.learning_path_id, 0)
        completed = done.get((enrollment.user_id, enrollment.learning_path_id), 0)
        result[enrollment.user_id] = LearningProgressRef(
            learning_path_id=enrollment.learning_path_id,
            name=name,
            progress_percent=round(100 * completed / total) if total else 0,
            completed_task_count=completed,
            total_task_count=total,
        )
    return result


# ── PM management ───────────────────────────────────────────────────────────


def list_learning_paths(db: Session, actor: User) -> list[LearningPathListItem]:
    _require_manager(actor)
    paths = list(db.scalars(select(LearningPath).order_by(func.lower(LearningPath.name))))
    ids = [p.learning_path_id for p in paths]
    modules = dict(
        db.execute(
            select(LearningModule.learning_path_id, func.count())
            .where(LearningModule.learning_path_id.in_(ids))
            .group_by(LearningModule.learning_path_id)
        ).all()
    )
    tasks = dict(
        db.execute(
            select(LearningModule.learning_path_id, func.count(LearningTask.learning_task_id))
            .join(LearningTask, LearningTask.learning_module_id == LearningModule.learning_module_id)
            .where(LearningModule.learning_path_id.in_(ids))
            .group_by(LearningModule.learning_path_id)
        ).all()
    )
    enrolled = dict(
        db.execute(
            select(LearningPathEnrollment.learning_path_id, func.count())
            .where(LearningPathEnrollment.learning_path_id.in_(ids))
            .group_by(LearningPathEnrollment.learning_path_id)
        ).all()
    )
    return [
        LearningPathListItem(
            learning_path_id=p.learning_path_id,
            name=p.name,
            description=p.description,
            module_count=modules.get(p.learning_path_id, 0),
            task_count=tasks.get(p.learning_path_id, 0),
            enrolled_count=enrolled.get(p.learning_path_id, 0),
        )
        for p in paths
    ]


def get_learning_path_detail(db: Session, actor: User, learning_path_id: uuid.UUID) -> LearningPathDetailOut:
    _require_manager(actor)
    structure = _load(db, learning_path_id)
    rows = db.execute(
        select(LearningPathEnrollment, User)
        .join(User, User.user_id == LearningPathEnrollment.user_id)
        .where(LearningPathEnrollment.learning_path_id == learning_path_id)
        .order_by(func.lower(User.display_name))
    ).all()
    progress = learning_progress_refs(db, [u.user_id for _, u in rows])
    return LearningPathDetailOut(
        learning_path_id=structure.path.learning_path_id,
        name=structure.path.name,
        description=structure.path.description,
        modules=_modules_out(structure, {}),
        total_task_count=len(structure.all_tasks),
        enrollments=[
            LearningEnrollmentOut(
                researcher=UserRef.model_validate(user),
                progress_percent=progress[user.user_id].progress_percent if user.user_id in progress else 0,
                completed_at=enrollment.completed_at,
                target_date=enrollment.target_date,
            )
            for enrollment, user in rows
        ],
    )


def create_learning_path(db: Session, actor: User, data: LearningPathCreate) -> LearningPathDetailOut:
    _require_manager(actor)
    if db.scalar(select(LearningPath.learning_path_id).where(func.lower(LearningPath.name) == data.name.lower())):
        raise ConflictError("A learning path with this name already exists", field="name")
    path = LearningPath(
        learning_path_id=uuid.uuid4(), name=data.name, description=data.description, created_by_user_id=actor.user_id
    )
    db.add(path)
    db.flush()
    _add_modules(db, path.learning_path_id, data.modules, start_position=0)
    db.commit()
    return get_learning_path_detail(db, actor, path.learning_path_id)


def _add_modules(db: Session, learning_path_id: uuid.UUID, modules, *, start_position: int) -> None:
    for offset, module_in in enumerate(modules):
        module = LearningModule(
            learning_module_id=uuid.uuid4(),
            learning_path_id=learning_path_id,
            title=module_in.title,
            position=start_position + offset,
        )
        db.add(module)
        db.flush()
        db.add_all(
            LearningTask(
                learning_task_id=uuid.uuid4(),
                learning_module_id=module.learning_module_id,
                title=t.title,
                description=t.description,
                resource_url=t.resource_url,
                estimated_hours=t.estimated_hours,
                position=i,
            )
            for i, t in enumerate(module_in.tasks)
        )


def add_learning_module(db: Session, actor: User, learning_path_id: uuid.UUID, module_in) -> LearningPathDetailOut:
    _require_manager(actor)
    _load(db, learning_path_id)
    last = db.scalar(select(func.max(LearningModule.position)).where(LearningModule.learning_path_id == learning_path_id))
    _add_modules(db, learning_path_id, [module_in], start_position=(last if last is not None else -1) + 1)
    # A new module re-opens the path for anyone who had finished it.
    for enrollment in db.scalars(select(LearningPathEnrollment).where(LearningPathEnrollment.learning_path_id == learning_path_id)):
        enrollment.completed_at = None
    db.commit()
    return get_learning_path_detail(db, actor, learning_path_id)


def assign_learning_path(
    db: Session, actor: User, researcher_user_id: uuid.UUID, learning_path_id: uuid.UUID, target_date
) -> LearningProgressOut:
    _require_manager(actor)
    researcher = db.get(User, researcher_user_id)
    if researcher is None or not researcher.is_active:
        raise NotFoundError("Researcher not found")
    structure = _load(db, learning_path_id)
    if not structure.all_tasks:
        raise InvalidInputError("This learning path has no tasks yet", field="learning_path_id")
    enrollment = db.get(LearningPathEnrollment, researcher_user_id)
    changed = True
    if enrollment is None:
        enrollment = LearningPathEnrollment(
            user_id=researcher_user_id,
            learning_path_id=learning_path_id,
            enrollment_version=1,
            assigned_by_user_id=actor.user_id,
            target_date=target_date,
        )
        db.add(enrollment)
    elif enrollment.learning_path_id != learning_path_id:
        enrollment.learning_path_id = learning_path_id
        enrollment.enrollment_version += 1
        enrollment.assigned_by_user_id = actor.user_id
        enrollment.assigned_at = datetime.now(UTC)
        enrollment.completed_at = None
        enrollment.target_date = target_date
    else:
        enrollment.target_date = target_date  # same path: just a new target date, no notification
        changed = False
    db.commit()
    if changed:
        first = structure.all_tasks[0]
        emit_notification_event(
            LearningPathAssignedEvent(
                actor_user_id=actor.user_id,
                learning_path_id=learning_path_id,
                learning_path_name=structure.path.name,
                first_task_title=first.title,
                researcher_user_id=researcher_user_id,
                enrollment_version=enrollment.enrollment_version,
            ),
            SessionLocal,
        )
    return _progress(db, enrollment)
