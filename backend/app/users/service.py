import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import ConflictError, PermissionDeniedError
from app.users.domain import AccessStatus, Role
from app.users.models import User
from app.users.schemas import MeOut, MeUpdate, UserCreate, UserListItem


def get_me(user: User) -> MeOut:
    return MeOut.model_validate(user)


def update_me(db: Session, user: User, data: MeUpdate) -> MeOut:
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    for key, value in changes.items():
        setattr(user, key, value)
    db.commit()
    return MeOut.model_validate(user)


def list_users(db: Session, *, role: Role | None = None) -> list[UserListItem]:
    stmt = select(User).where(User.is_active.is_(True), User.access_status == AccessStatus.APPROVED).order_by(func.lower(User.display_name))
    if role is not None:
        stmt = stmt.where(User.role == role)
    return [UserListItem.model_validate(u) for u in db.scalars(stmt)]


def create_user(db: Session, actor: User, data: UserCreate) -> UserListItem:
    """PMs add people to PandaHat from the Team page; no seed scripts needed."""
    if not actor.is_manager:
        raise PermissionDeniedError("Only project managers can add team members")
    if data.role == Role.ADMIN and actor.role != Role.ADMIN:
        raise PermissionDeniedError("Only admins can create other admins")
    email = data.email.lower()
    if db.scalar(select(User.user_id).where(func.lower(User.email) == email)):
        raise ConflictError("Someone with this email is already on the team", field="email")
    user = User(
        user_id=uuid.uuid4(),
        display_name=data.display_name,
        email=email,
        role=data.role,
        research_status=data.research_status,
        commitment=data.commitment,
        skills=data.skills,
    )
    db.add(user)
    db.commit()
    return UserListItem.model_validate(user)
