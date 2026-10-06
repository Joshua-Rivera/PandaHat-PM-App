import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Notification(Base):
    """One row per recipient per logical event. This row IS the in-app notification.

    The ORM model describes the table for queries. The table itself, with its
    constraints and indexes, is created by the Alembic migration
    `0002_create_notifications`, which is the source of truth.
    """

    __tablename__ = "notifications"

    notification_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"))
    event_type: Mapped[str] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    resource_type: Mapped[str | None] = mapped_column(Text)
    resource_id: Mapped[str | None] = mapped_column(Text)
    action_path: Mapped[str | None] = mapped_column(Text)
    dedupe_key: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
