import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import CurrentUser, ManagerUser
from app.db import get_db
from app.learning import service as learning_service
from app.learning.schemas import AssignLearningPathRequest, LearningProgressOut
from app.team import service
from app.team.schemas import ResearcherDetailOut
from app.users.schemas import ResearcherSummaryOut, ResearcherUpdate

Db = Annotated[Session, Depends(get_db)]

router = APIRouter(prefix="/api/v1/researchers", tags=["team"])


@router.get("", operation_id="listResearchers", response_model=list[ResearcherSummaryOut])
def list_researchers(actor: ManagerUser, db: Db) -> list[ResearcherSummaryOut]:
    """Every active researcher with capacity, projects and learning progress."""
    return service.list_researchers(db, actor)


@router.get("/{user_id}", operation_id="getResearcher", response_model=ResearcherDetailOut)
def get_researcher(user_id: uuid.UUID, viewer: CurrentUser, db: Db) -> ResearcherDetailOut:
    """Managers can view anyone; researchers can view only themselves."""
    return service.get_researcher_detail(db, viewer, user_id)


@router.patch("/{user_id}", operation_id="updateResearcher", response_model=ResearcherDetailOut)
def update_researcher(user_id: uuid.UUID, body: ResearcherUpdate, actor: ManagerUser, db: Db) -> ResearcherDetailOut:
    return service.update_researcher(db, actor, user_id, body)


@router.put("/{user_id}/learning-path", operation_id="assignLearningPath", response_model=LearningProgressOut)
def assign_learning_path(
    user_id: uuid.UUID, body: AssignLearningPathRequest, actor: ManagerUser, db: Db
) -> LearningProgressOut:
    return learning_service.assign_learning_path(db, actor, user_id, body.learning_path_id, body.target_date)
