"""DEVELOPMENT-ONLY endpoints behind the frontend's "Viewing as" switcher.

main.py mounts this router only when AUTH_MODE=dev, and config.py refuses to
start with AUTH_MODE=dev in production, so these routes cannot exist on a
deployed server. They are unauthenticated by design: their whole job is to let
a developer pick who to be.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ConflictError
from app.users.domain import Commitment, ResearchStatus, Role
from app.users.models import User
from app.users.schemas import DisplayName, UserListItem

router = APIRouter(prefix="/api/v1/dev", tags=["dev-only"])

Db = Annotated[Session, Depends(get_db)]


class BootstrapRequest(BaseModel):
    display_name: DisplayName
    email: EmailStr


@router.get("/identities", operation_id="listDevIdentities", response_model=list[UserListItem])
def list_dev_identities(db: Db) -> list[UserListItem]:
    users = db.scalars(
        select(User).where(User.is_active.is_(True)).order_by(User.role.desc(), func.lower(User.display_name))
    )
    return [UserListItem.model_validate(u) for u in users]


@router.post("/bootstrap", operation_id="bootstrapDevAdmin", response_model=UserListItem, status_code=status.HTTP_201_CREATED)
def bootstrap_dev_admin(body: BootstrapRequest, db: Db) -> UserListItem:
    """On an EMPTY database, create the first project manager so the rest of the
    organisation can be built through the UI. Refuses once any user exists."""
    if db.scalar(select(func.count()).select_from(User)):
        raise ConflictError("The database already has users; pick one from 'Viewing as'")
    user = User(
        user_id=uuid.uuid4(),
        display_name=body.display_name,
        email=body.email.lower(),
        role=Role.PROJECT_MANAGER,
        research_status=ResearchStatus.RESEARCH,
        commitment=Commitment.FULL_TIME,
    )
    db.add(user)
    db.commit()
    return UserListItem.model_validate(user)
