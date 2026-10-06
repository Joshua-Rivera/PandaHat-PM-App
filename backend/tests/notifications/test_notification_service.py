import logging
import uuid

import pytest

from sqlalchemy import select

from app.db import SessionLocal
from app.notifications.persistence.models import Notification
from app.notifications.services import notification_service
from app.notifications.services.emit import emit_notification_event
from app.notifications.services.notification_service import NotificationService
from tests.notifications.factories import task_assigned_event

pytestmark = pytest.mark.usefixtures("clean_db")


def _all(db):
    db.expire_all()
    return list(db.scalars(select(Notification)))


def test_task_assigned_creates_one_inbox_notification(db, researcher, pm):
    ids = NotificationService(db).handle_event(task_assigned_event(researcher.user_id, actor_user_id=pm.user_id))
    [n] = _all(db)
    assert ids == [n.notification_id]
    assert n.recipient_user_id == researcher.user_id
    assert n.actor_user_id == pm.user_id
    assert n.event_type == "TASK_ASSIGNED"
    assert n.priority == "NORMAL"  # from EVENT_REGISTRY, not from the caller
    assert n.title == "New task: Evaluate TrustMark after JPEG compression"
    assert n.resource_type == "task"
    assert n.action_path.startswith("/projects/")
    assert n.read_at is None


def test_handle_event_commits(researcher):
    with SessionLocal() as writer:
        NotificationService(writer).handle_event(task_assigned_event(researcher.user_id))
    with SessionLocal() as reader:  # a different session only sees committed data
        assert len(list(reader.scalars(select(Notification)))) == 1


def test_same_event_twice_creates_one_notification(db, researcher):
    service = NotificationService(db)
    assert len(service.handle_event(task_assigned_event(researcher.user_id))) == 1
    assert service.handle_event(task_assigned_event(researcher.user_id)) == []
    assert len(_all(db)) == 1


def test_reassignment_with_new_version_is_a_new_notification(db, researcher):
    service = NotificationService(db)
    service.handle_event(task_assigned_event(researcher.user_id, version=1))
    service.handle_event(task_assigned_event(researcher.user_id, version=3))
    assert len(_all(db)) == 2


def test_inactive_recipient_gets_nothing(db, researcher):
    researcher.is_active = False
    db.commit()
    assert NotificationService(db).handle_event(task_assigned_event(researcher.user_id)) == []
    assert _all(db) == []


def test_emit_never_raises_and_logs_failure(monkeypatch, caplog, researcher):
    def explode(self, event):
        raise RuntimeError("database on fire")

    monkeypatch.setattr(notification_service.NotificationService, "handle_event", explode)
    with caplog.at_level(logging.ERROR):
        assert emit_notification_event(task_assigned_event(researcher.user_id), SessionLocal) == []
    assert "notification.emit_failed" in caplog.text


def test_emit_returns_created_ids(researcher):
    assert len(emit_notification_event(task_assigned_event(researcher.user_id), SessionLocal)) == 1


def test_unknown_recipient_does_not_break_emit():
    # FK violation inside the service → swallowed by emit, logged, returns [].
    assert emit_notification_event(task_assigned_event(uuid.uuid4()), SessionLocal) == []
