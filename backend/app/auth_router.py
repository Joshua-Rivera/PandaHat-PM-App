"""Sign-in plumbing and PM approval of new members."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, StringConstraints
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import identity
from app.auth import ManagerUser, SignedInUser
from app.db import get_db
from app.errors import ConflictError, NotFoundError, PermissionDeniedError
from app.users.domain import AccessStatus, Commitment, ResearchStatus, Role
from app.users.models import User, UserIdentity

Db = Annotated[Session, Depends(get_db)]

router = APIRouter(prefix="/api/v1", tags=["auth"])

GithubLogin = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Za-z0-9-]{1,39}$")]


class GithubLoginIn(BaseModel):
    login: GithubLogin


class PendingMemberOut(BaseModel):
    user_id: uuid.UUID
    display_name: str
    email: str
    avatar_url: str | None
    github_login: str | None
    requested_at: str


class ApproveMemberIn(BaseModel):
    role: Role = Role.RESEARCHER
    research_status: ResearchStatus = ResearchStatus.LEARNING_PATH
    commitment: Commitment = Commitment.SHADOW


@router.post("/auth/github-login", operation_id="recordGithubLogin", status_code=status.HTTP_204_NO_CONTENT)
def record_github_login(body: GithubLoginIn, user: SignedInUser, db: Db) -> None:
    identity.record_github_login(db, user, body.login)


@router.get("/users/pending", operation_id="listPendingMembers", response_model=list[PendingMemberOut])
def list_pending(_actor: ManagerUser, db: Db) -> list[PendingMemberOut]:
    """People who signed in with GitHub but aren't on the team yet."""
    login = (
        select(UserIdentity.github_login)
        .where(UserIdentity.user_id == User.user_id)
        .order_by(UserIdentity.last_sign_in_at.desc())
        .limit(1)
        .scalar_subquery()
    )
    rows = db.execute(
        select(User, login)
        .where(User.access_status == AccessStatus.PENDING, User.is_active.is_(True))
        .order_by(User.created_at)
    )
    return [
        PendingMemberOut(
            user_id=u.user_id,
            display_name=u.display_name,
            email=u.email,
            avatar_url=u.avatar_url,
            github_login=gh,
            requested_at=u.created_at.isoformat(),
        )
        for u, gh in rows
    ]


def _pending(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise NotFoundError("Member not found")
    if user.access_status != AccessStatus.PENDING:
        raise ConflictError("This member has already been approved")
    return user


@router.post("/users/{user_id}/approve", operation_id="approveMember", status_code=status.HTTP_204_NO_CONTENT)
def approve_member(user_id: uuid.UUID, body: ApproveMemberIn, actor: ManagerUser, db: Db) -> None:
    user = _pending(db, user_id)
    if body.role == Role.ADMIN and actor.role != Role.ADMIN:
        raise PermissionDeniedError("Only admins can create other admins")
    user.role, user.research_status, user.commitment = body.role, body.research_status, body.commitment
    user.access_status = AccessStatus.APPROVED
    db.commit()


@router.post("/users/{user_id}/reject", operation_id="rejectMember", status_code=status.HTTP_204_NO_CONTENT)
def reject_member(user_id: uuid.UUID, _actor: ManagerUser, db: Db) -> None:
    """Deactivates the request. Their next sign-in is refused; nothing is deleted."""
    user = _pending(db, user_id)
    user.is_active = False
    db.commit()


@router.get("/users/pending/count", operation_id="countPendingMembers")
def count_pending(_actor: ManagerUser, db: Db) -> dict[str, int]:
    n = db.scalar(
        select(func.count()).where(User.access_status == AccessStatus.PENDING, User.is_active.is_(True))
    )
    return {"count": n or 0}
