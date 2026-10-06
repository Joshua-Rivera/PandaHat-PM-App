"""The ONLY entry point other PandaHat domains use to raise notifications.

Contract: this function never raises. A notification bug, a DB hiccup or a
missing template must not turn a successful task assignment into a 500. The
caller has already committed its own business transaction before calling us.
"""

import logging
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.notifications.domain.events import NotificationEvent
from app.notifications.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


def emit_notification_event(event: NotificationEvent, session_factory: Callable[[], Session]) -> list[int]:
    # A dedicated session isolates notification work from the caller's
    # transaction: our failure can't poison their session, and vice versa.
    db = session_factory()
    try:
        return NotificationService(db).handle_event(event)
    except Exception:
        db.rollback()
        logger.exception("notification.emit_failed event_type=%s", event.event_type)
        return []
    finally:
        db.close()
