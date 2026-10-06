"""HTTP layer for projects and tasks. Routers only translate HTTP ↔ service
calls; every rule (who may do what, validation against the DB, notifications)
lives in app.research.service.

Every operation_id is unique and becomes the frontend client function name.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth import CurrentUser, ManagerUser
from app.db import get_db
from app.errors import InvalidInputError
from app.research import service
from app.research.domain import TaskStatus
from app.research.schemas import (
    ActivityItemOut,
    AddProjectMemberRequest,
    AssignTaskRequest,
    ProjectCreate,
    ProjectDetailOut,
    ProjectSummaryOut,
    ProjectUpdate,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)

Db = Annotated[Session, Depends(get_db)]

projects_router = APIRouter(prefix="/api/v1/projects", tags=["projects"])
router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


# ── Projects ────────────────────────────────────────────────────────────────


@projects_router.get("", operation_id="listProjects", response_model=list[ProjectSummaryOut])
def list_projects(user: CurrentUser, db: Db, include_archived: bool = False) -> list[ProjectSummaryOut]:
    """Managers see every project; researchers see the projects they belong to."""
    return service.list_projects(db, user, include_archived=include_archived)


@projects_router.post("", operation_id="createProject", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectCreate, actor: ManagerUser, db: Db) -> ProjectDetailOut:
    return service.create_project(db, actor, body)


@projects_router.get("/{project_id}", operation_id="getProject", response_model=ProjectDetailOut)
def get_project(project_id: uuid.UUID, user: CurrentUser, db: Db) -> ProjectDetailOut:
    return service.get_project_detail(db, user, project_id)


@projects_router.patch("/{project_id}", operation_id="updateProject", response_model=ProjectDetailOut)
def update_project(project_id: uuid.UUID, body: ProjectUpdate, actor: ManagerUser, db: Db) -> ProjectDetailOut:
    return service.update_project(db, actor, project_id, body)


@projects_router.get("/{project_id}/activity", operation_id="listProjectActivity", response_model=list[ActivityItemOut])
def list_project_activity(project_id: uuid.UUID, user: CurrentUser, db: Db) -> list[ActivityItemOut]:
    return service.project_activity(db, user, project_id)


@projects_router.post("/{project_id}/members", operation_id="addProjectMember", response_model=ProjectDetailOut)
def add_project_member(project_id: uuid.UUID, body: AddProjectMemberRequest, actor: ManagerUser, db: Db) -> ProjectDetailOut:
    return service.add_project_member(db, actor, project_id, body.user_id)


@projects_router.delete("/{project_id}/members/{user_id}", operation_id="removeProjectMember", response_model=ProjectDetailOut)
def remove_project_member(project_id: uuid.UUID, user_id: uuid.UUID, actor: ManagerUser, db: Db) -> ProjectDetailOut:
    return service.remove_project_member(db, actor, project_id, user_id)


# ── Tasks ───────────────────────────────────────────────────────────────────


@router.get("", operation_id="listTasks", response_model=list[TaskOut])
def list_tasks(
    user: CurrentUser,
    db: Db,
    project_id: uuid.UUID | None = None,
    assignee: Annotated[str | None, Query(description='"me" or a user id')] = None,
    task_status: Annotated[list[TaskStatus] | None, Query(alias="status")] = None,
    include_archived: bool = False,
) -> list[TaskOut]:
    assignee_user_id = None
    if assignee == "me":
        assignee_user_id = user.user_id
    elif assignee:
        try:
            assignee_user_id = uuid.UUID(assignee)
        except ValueError:
            raise InvalidInputError('assignee must be "me" or a user id', field="assignee")
    return service.list_tasks(
        db, user, project_id=project_id, assignee_user_id=assignee_user_id, statuses=task_status,
        include_archived=include_archived,
    )


@router.post("", operation_id="createTask", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(body: TaskCreate, actor: ManagerUser, db: Db) -> TaskOut:
    return service.create_task(db, actor, body)


@router.get("/{task_id}", operation_id="getTask", response_model=TaskOut)
def get_task(task_id: uuid.UUID, user: CurrentUser, db: Db) -> TaskOut:
    return service.get_task(db, user, task_id)


@router.patch("/{task_id}", operation_id="updateTask", response_model=TaskOut)
def update_task(task_id: uuid.UUID, body: TaskUpdate, user: CurrentUser, db: Db) -> TaskOut:
    """Managers may change any field. The assignee may change `status` only."""
    return service.update_task(db, user, task_id, body)


@router.put("/{task_id}/assignee", operation_id="setTaskAssignee", response_model=TaskOut)
def set_task_assignee(task_id: uuid.UUID, body: AssignTaskRequest, actor: ManagerUser, db: Db) -> TaskOut:
    return service.set_task_assignee(db, actor, task_id, body.assignee_user_id)


@router.delete("/{task_id}", operation_id="archiveTask", status_code=status.HTTP_204_NO_CONTENT)
def archive_task(task_id: uuid.UUID, actor: ManagerUser, db: Db) -> Response:
    service.archive_task(db, actor, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

