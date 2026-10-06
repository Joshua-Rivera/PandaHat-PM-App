import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Identity, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.users.domain import COMMITMENT_HOURS, MANAGER_ROLES, AccessStatus, Commitment, ResearchStatus, Role


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    display_name: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, unique=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(Text, default=Role.RESEARCHER)  # see app.users.domain.Role
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    research_status: Mapped[str] = mapped_column(Text, default=ResearchStatus.LEARNING_PATH)
    skills: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    commitment: Mapped[str] = mapped_column(Text, default=Commitment.SHADOW)
    access_status: Mapped[str] = mapped_column(Text, default=AccessStatus.APPROVED)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def is_manager(self) -> bool:
        return self.role in MANAGER_ROLES

    @property
    def committed_hours(self) -> float:
        return COMMITMENT_HOURS[self.commitment]

    @property
    def is_approved(self) -> bool:
        return self.access_status == AccessStatus.APPROVED


class UserIdentity(Base):
    """A sign-in account (Firebase uid, backed by a GitHub account) linked to a PandaHat user."""

    __tablename__ = "user_identities"

    user_identity_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"))
    firebase_uid: Mapped[str] = mapped_column(Text, unique=True)
    github_user_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True)
    github_login: Mapped[str | None] = mapped_column(Text, nullable=True)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_sign_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
