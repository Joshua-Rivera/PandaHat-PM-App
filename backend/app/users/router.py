from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth import CurrentUser, ManagerUser, SignedInUser
from app.db import get_db
from app.users import service
from app.users.domain import Role
from app.users.schemas import MeOut, MeUpdate, UserCreate, UserListItem

Db = Annotated[Session, Depends(get_db)]

me_router = APIRouter(prefix="/api/v1/me", tags=["me"])
router = APIRouter(prefix="/api/v1/users", tags=["users"])


@me_router.get("", operation_id="getMe", response_model=MeOut)
def get_me(user: SignedInUser) -> MeOut:
    """Works for pending accounts too, so the frontend can show the waiting screen."""
    return service.get_me(user)


@me_router.patch("", operation_id="updateMe", response_model=MeOut)
def update_me(body: MeUpdate, user: CurrentUser, db: Db) -> MeOut:
    return service.update_me(db, user, body)


@router.get("", operation_id="listUsers", response_model=list[UserListItem])
def list_users(_user: CurrentUser, db: Db, role: Role | None = None) -> list[UserListItem]:
    return service.list_users(db, role=role)


@router.post("", operation_id="createUser", response_model=UserListItem, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, actor: ManagerUser, db: Db) -> UserListItem:
    return service.create_user(db, actor, body)
