from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import CurrentUser, ManagerUser
from app.dashboard import service
from app.dashboard.schemas import MyDashboardOut, TeamOverviewOut
from app.db import get_db

Db = Annotated[Session, Depends(get_db)]

router = APIRouter(prefix="/api/v1", tags=["dashboard"])


@router.get("/me/dashboard", operation_id="getMyDashboard", response_model=MyDashboardOut)
def get_my_dashboard(user: CurrentUser, db: Db) -> MyDashboardOut:
    return service.my_dashboard(db, user)


@router.get("/overview", operation_id="getTeamOverview", response_model=TeamOverviewOut)
def get_team_overview(actor: ManagerUser, db: Db) -> TeamOverviewOut:
    return service.team_overview(db, actor)
