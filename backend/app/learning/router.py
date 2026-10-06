import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth import CurrentUser, ManagerUser
from app.db import get_db
from app.learning import service
from app.learning.schemas import (
    LearningModuleIn,
    LearningPathCreate,
    LearningPathDetailOut,
    LearningPathListItem,
    LearningTaskCompletionRequest,
    MyLearningPathOut,
)

Db = Annotated[Session, Depends(get_db)]

me_router = APIRouter(prefix="/api/v1/me", tags=["learning"])
router = APIRouter(prefix="/api/v1/learning-paths", tags=["learning"])


@me_router.get("/learning-path", operation_id="getMyLearningPath", response_model=MyLearningPathOut)
def get_my_learning_path(user: CurrentUser, db: Db) -> MyLearningPathOut:
    return service.get_my_learning_path(db, user)


@me_router.put(
    "/learning-tasks/{learning_task_id}/completion",
    operation_id="setMyLearningTaskCompletion",
    response_model=MyLearningPathOut,
)
def set_my_learning_task_completion(
    learning_task_id: uuid.UUID, body: LearningTaskCompletionRequest, user: CurrentUser, db: Db
) -> MyLearningPathOut:
    return service.set_my_task_completion(db, user, learning_task_id, body.is_completed)


@router.get("", operation_id="listLearningPaths", response_model=list[LearningPathListItem])
def list_learning_paths(actor: ManagerUser, db: Db) -> list[LearningPathListItem]:
    return service.list_learning_paths(db, actor)


@router.post("", operation_id="createLearningPath", response_model=LearningPathDetailOut, status_code=status.HTTP_201_CREATED)
def create_learning_path(body: LearningPathCreate, actor: ManagerUser, db: Db) -> LearningPathDetailOut:
    return service.create_learning_path(db, actor, body)


@router.get("/{learning_path_id}", operation_id="getLearningPath", response_model=LearningPathDetailOut)
def get_learning_path(learning_path_id: uuid.UUID, actor: ManagerUser, db: Db) -> LearningPathDetailOut:
    return service.get_learning_path_detail(db, actor, learning_path_id)


@router.post("/{learning_path_id}/modules", operation_id="addLearningModule", response_model=LearningPathDetailOut)
def add_learning_module(learning_path_id: uuid.UUID, body: LearningModuleIn, actor: ManagerUser, db: Db) -> LearningPathDetailOut:
    return service.add_learning_module(db, actor, learning_path_id, body)
