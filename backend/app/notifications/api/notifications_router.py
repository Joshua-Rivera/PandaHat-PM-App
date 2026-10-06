from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.db import get_db
from app.notifications.api.schemas import (
    MarkAllReadOut,
    MarkAllReadRequest,
    MarkReadRequest,
    NotificationOut,
    NotificationPageOut,
    UnreadCountOut,
)
from app.notifications.persistence import notification_repository as repo
from app.notifications.persistence.pagination import FeedCursor, InvalidCursorError

# Every path is under /me: the user comes from the session, never from the URL.
router = APIRouter(prefix="/api/v1/me/notifications", tags=["notifications"])

Db = Annotated[Session, Depends(get_db)]


def _not_found() -> HTTPException:
    # 404 (not 403) for other users' notifications: don't confirm the id exists.
    return HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")


@router.get("", operation_id="listMyNotifications", response_model=NotificationPageOut)
def list_my_notifications(
    user: CurrentUser,
    db: Db,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    status_filter: Annotated[Literal["all", "unread"], Query(alias="status")] = "all",
) -> NotificationPageOut:
    try:
        decoded = FeedCursor.decode(cursor) if cursor else None
    except InvalidCursorError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid cursor")
    page = repo.list_notifications_for_user(
        db, user.user_id, cursor=decoded, limit=limit, unread_only=status_filter == "unread"
    )
    return NotificationPageOut(
        items=[NotificationOut.model_validate(n) for n in page.items],
        next_cursor=page.next_cursor.encode() if page.next_cursor else None,
    )


@router.get("/unread-count", operation_id="getMyUnreadNotificationCount", response_model=UnreadCountOut)
def get_my_unread_notification_count(user: CurrentUser, db: Db) -> UnreadCountOut:
    return UnreadCountOut(unread_count=repo.count_unread_notifications(db, user.user_id))


@router.post("/mark-all-read", operation_id="markAllMyNotificationsRead", response_model=MarkAllReadOut)
def mark_all_my_notifications_read(body: MarkAllReadRequest, user: CurrentUser, db: Db) -> MarkAllReadOut:
    updated = repo.mark_all_notifications_read(db, user.user_id, read_before=body.read_before, now=datetime.now(UTC))
    db.commit()
    return MarkAllReadOut(updated_count=updated)


@router.get("/{notification_id}", operation_id="getMyNotification", response_model=NotificationOut)
def get_my_notification(notification_id: int, user: CurrentUser, db: Db) -> NotificationOut:
    notification = repo.get_notification_for_user(db, user.user_id, notification_id)
    if notification is None:
        raise _not_found()
    return NotificationOut.model_validate(notification)


@router.patch("/{notification_id}", operation_id="updateMyNotificationReadState", response_model=NotificationOut)
def update_my_notification_read_state(
    notification_id: int, body: MarkReadRequest, user: CurrentUser, db: Db
) -> NotificationOut:
    notification = repo.set_notification_read_state(
        db, user.user_id, notification_id, is_read=body.is_read, now=datetime.now(UTC)
    )
    if notification is None:
        raise _not_found()
    db.commit()
    return NotificationOut.model_validate(notification)
