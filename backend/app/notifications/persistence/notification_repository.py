"""All SQL for the notifications table lives here, and only here.

Verify with:
    .venv/bin/pytest tests/notifications/test_notification_repository.py

Rules that apply to every function:
  * Every query that touches a user's notifications filters on
    `Notification.recipient_user_id == user_id`. That filter IS the
    authorization check: forgetting it is an IDOR vulnerability.
  * Repositories never commit. The caller (service/router) owns the transaction,
    so several repository calls can succeed or fail together. Use db.flush() if
    you need generated values before commit.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.notifications.domain.event_types import EventType, Priority
from app.notifications.domain.events import InAppContent
from app.notifications.persistence.models import Notification
from app.notifications.persistence.pagination import FeedCursor


@dataclass(frozen=True)
class NotificationPage:
    items: list[Notification]
    next_cursor: FeedCursor | None  # None means "this was the last page"


def insert_notification_if_absent(
    db: Session,
    *,
    recipient_user_id: uuid.UUID,
    actor_user_id: uuid.UUID | None,
    event_type: EventType,
    priority: Priority,
    content: InAppContent,
    dedupe_key: str,
) -> int | None:
    """Insert one notification. Return its notification_id, or None if
    (recipient_user_id, dedupe_key) already exists.

    This is the heart of duplicate prevention. Do NOT "SELECT to check, then
    INSERT": two concurrent requests can both see "absent" and both insert.
    Let the UNIQUE constraint decide atomically:

        insert(Notification).values(...)
            .on_conflict_do_nothing(constraint="uq_notifications_recipient_dedupe")
            .returning(Notification.notification_id)

    With DO NOTHING, RETURNING yields no row on conflict, so use .scalar_one_or_none().
    Enum and ResourceType values: store them with str(...).
    """
    stmt = (
        insert(Notification)
        .values(
            recipient_user_id=recipient_user_id,
            actor_user_id=actor_user_id,
            event_type=str(event_type),
            priority=str(priority),
            title=content.title,
            body=content.body,
            resource_type=str(content.resource_type) if content.resource_type else None,
            resource_id=content.resource_id,
            action_path=content.action_path,
            dedupe_key=dedupe_key,
        )
        .on_conflict_do_nothing(constraint="uq_notifications_recipient_dedupe")
        .returning(Notification.notification_id)
    )
    return db.execute(stmt).scalar_one_or_none()


def list_notifications_for_user(
    db: Session, user_id: uuid.UUID, *, cursor: FeedCursor | None, limit: int, unread_only: bool
) -> NotificationPage:
    """Newest-first page of the user's notifications, using KEYSET pagination.

    * Order by (created_at DESC, notification_id DESC). That matches ix_notifications_recipient_feed.
    * If cursor is given, keep only rows strictly "older" than it. A row-value comparison
      does exactly that in one condition:
          tuple_(Notification.created_at, Notification.notification_id)
              < tuple_(cursor.created_at, cursor.notification_id)
    * unread_only → read_at IS NULL.
    * Trick for knowing whether there's a next page without a COUNT: fetch limit + 1 rows.
      If you got more than `limit`, return the first `limit` and build next_cursor
      from the LAST RETURNED item; otherwise next_cursor is None.

    The test with 5 identical timestamps checks that your tiebreaker works.
    """
    stmt = select(Notification).where(Notification.recipient_user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    if cursor is not None:
        stmt = stmt.where(
            tuple_(Notification.created_at, Notification.notification_id)
            < tuple_(cursor.created_at, cursor.notification_id)
        )
    stmt = stmt.order_by(Notification.created_at.desc(), Notification.notification_id.desc()).limit(limit + 1)
    rows = list(db.scalars(stmt))
    if len(rows) <= limit:
        return NotificationPage(items=rows, next_cursor=None)
    items = rows[:limit]
    last = items[-1]
    return NotificationPage(items=items, next_cursor=FeedCursor(last.created_at, last.notification_id))


def get_notification_for_user(db: Session, user_id: uuid.UUID, notification_id: int) -> Notification | None:
    """The notification if it exists AND belongs to user_id, otherwise None.
    (The router turns None into 404, not 403, so ids of other users' rows aren't revealed.)"""
    return db.scalar(
        select(Notification).where(
            Notification.recipient_user_id == user_id,
            Notification.notification_id == notification_id,
        )
    )


def count_unread_notifications(db: Session, user_id: uuid.UUID) -> int:
    """COUNT of the user's rows with read_at IS NULL. ix_notifications_recipient_unread
    makes this cheap enough to poll every 30s."""
    return db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.recipient_user_id == user_id, Notification.read_at.is_(None))
    )


def set_notification_read_state(
    db: Session, user_id: uuid.UUID, notification_id: int, *, is_read: bool, now: datetime
) -> Notification | None:
    """Mark read (is_read=True) or unread (False). Return the updated row, or None if
    not found / not owned.

    Marking an already-read notification read again must KEEP the original read_at.
    The test checks this: "when did they first see it" is the useful fact.
    `now` is passed in, not computed here, so tests can control time.
    """
    notification = get_notification_for_user(db, user_id, notification_id)
    if notification is None:
        return None
    if is_read and notification.read_at is None:
        notification.read_at = now
    elif not is_read:
        notification.read_at = None
    db.flush()
    return notification


def mark_all_notifications_read(db: Session, user_id: uuid.UUID, *, read_before: datetime, now: datetime) -> int:
    """Set read_at = now on the user's unread rows created at or before read_before.
    Return how many rows changed (result.rowcount).

    Do it as ONE UPDATE statement, not a Python loop over rows. read_before protects
    a notification that arrives while the user is clicking the button.
    """
    result = db.execute(
        update(Notification)
        .where(
            Notification.recipient_user_id == user_id,
            Notification.read_at.is_(None),
            Notification.created_at <= read_before,
        )
        .values(read_at=now)
    )
    return result.rowcount
