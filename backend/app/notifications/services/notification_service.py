"""Turns a domain event into persisted notifications.

Verify with:
    .venv/bin/pytest tests/notifications/test_notification_service.py

This class is orchestration only: it decides WHAT happens and delegates HOW to
the repository. It must not import fastapi, build SQL, or send email.
"""

import logging
import uuid

from sqlalchemy.orm import Session

from app.notifications.domain.event_registry import EVENT_REGISTRY
from app.notifications.domain.event_types import Channel
from app.notifications.domain.events import NotificationEvent
from app.notifications.persistence import notification_repository as repo
from app.users.models import User

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def handle_event(self, event: NotificationEvent) -> list[int]:
        """Create one in-app notification per recipient and COMMIT. Return the ids
        that were newly created (duplicates are not included).

        Steps:
          1. spec = EVENT_REGISTRY[event.event_type]. Priority comes from the
             registry, never from the caller (sole exception: a PM marking an
             announcement URGENT, via event.priority_override()).
          2. If Channel.IN_APP is not in spec.default_channels, there's nothing to
             store yet (e.g. WEEKLY_RESEARCH_SUMMARY is email-only). Return [].
             (Phase 4 replaces this with effective_channels(spec, user prefs).)
          3. Render once: content = event.render_in_app()
          4. For each id in event.recipient_user_ids():
               - skip users that don't exist or aren't active (_is_active_user)
               - repo.insert_notification_if_absent(..., dedupe_key=event.dedupe_key(recipient))
               - None means duplicate: log at INFO and continue. It is NOT an error.
          5. self.db.commit() once at the end: all recipients or none.

        Logging: log "notification.created" (with id, event_type, recipient) and
        "notification.duplicate_skipped". Use %-style args, not f-strings, so the
        logging system formats them only when the line is actually emitted.

        Do NOT catch exceptions here. emit_notification_event (emit.py) is the
        single place that swallows them. Hiding errors in two places makes bugs
        invisible in tests.
        """
        spec = EVENT_REGISTRY[event.event_type]
        if Channel.IN_APP not in spec.default_channels:
            return []

        priority = event.priority_override() or spec.priority
        content = event.render_in_app()
        created: list[int] = []
        for recipient_user_id in event.recipient_user_ids():
            if not self._is_active_user(recipient_user_id):
                logger.info("notification.recipient_skipped event_type=%s recipient=%s", event.event_type, recipient_user_id)
                continue
            notification_id = repo.insert_notification_if_absent(
                self.db,
                recipient_user_id=recipient_user_id,
                actor_user_id=event.actor_user_id,
                event_type=event.event_type,
                priority=priority,
                content=content,
                dedupe_key=event.dedupe_key(recipient_user_id),
            )
            if notification_id is None:
                logger.info("notification.duplicate_skipped event_type=%s recipient=%s", event.event_type, recipient_user_id)
                continue
            logger.info(
                "notification.created id=%s event_type=%s recipient=%s", notification_id, event.event_type, recipient_user_id
            )
            created.append(notification_id)
        self.db.commit()
        return created

    def _is_active_user(self, user_id: uuid.UUID) -> bool:
        user = self.db.get(User, user_id)
        return user is not None and user.is_active
