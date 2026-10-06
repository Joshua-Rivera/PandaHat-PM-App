from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import CurrentUser, ManagerUser
from app.availability import service
from app.availability.schemas import AvailabilityOut, AvailabilityReplaceRequest, TeamMemberAvailabilityOut
from app.db import get_db

router = APIRouter(prefix="/api/v1/me/availability", tags=["availability"])
team_router = APIRouter(prefix="/api/v1/availability", tags=["availability"])

Db = Annotated[Session, Depends(get_db)]


@router.get("", operation_id="getMyAvailability", response_model=AvailabilityOut)
def get_my_availability(user: CurrentUser, db: Db) -> AvailabilityOut:
    return service.get_availability(db, user.user_id)


@router.put("", operation_id="replaceMyAvailability", response_model=AvailabilityOut)
def replace_my_availability(body: AvailabilityReplaceRequest, user: CurrentUser, db: Db) -> AvailabilityOut:
    return service.replace_availability(db, user.user_id, body)


@team_router.get("/team", operation_id="getTeamAvailability", response_model=list[TeamMemberAvailabilityOut])
def get_team_availability(_actor: ManagerUser, db: Db) -> list[TeamMemberAvailabilityOut]:
    """PM-only: every approved member's weekly blocks, commitment and capacity."""
    return service.team_availability(db)
