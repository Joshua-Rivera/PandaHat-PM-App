"""Checks that YOUR migration (0002) built the table the design report specifies."""

import uuid

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.db import engine

pytestmark = pytest.mark.usefixtures("clean_db")


def test_notifications_table_has_named_constraints_and_indexes():
    insp = inspect(engine)
    assert insp.get_pk_constraint("notifications")["name"] == "pk_notifications"
    uniques = {u["name"]: u["column_names"] for u in insp.get_unique_constraints("notifications")}
    assert uniques["uq_notifications_recipient_dedupe"] == ["recipient_user_id", "dedupe_key"]
    fks = {fk["name"] for fk in insp.get_foreign_keys("notifications")}
    assert {"fk_notifications_recipient_user_id", "fk_notifications_actor_user_id"} <= fks
    indexes = {ix["name"] for ix in insp.get_indexes("notifications")}
    assert {"ix_notifications_recipient_feed", "ix_notifications_recipient_unread"} <= indexes


def test_unread_index_is_partial():
    with engine.connect() as conn:
        indexdef = conn.scalar(
            text("SELECT indexdef FROM pg_indexes WHERE indexname = 'ix_notifications_recipient_unread'")
        )
    assert "WHERE (read_at IS NULL)" in indexdef


def _insert(conn, user_id, **overrides):
    values = dict(
        recipient_user_id=user_id, event_type="TASK_ASSIGNED", priority="NORMAL", title="t", body="b",
        resource_type=None, resource_id=None, action_path=None, dedupe_key=str(uuid.uuid4()),
    )
    values.update(overrides)
    conn.execute(
        text(
            "INSERT INTO notifications (recipient_user_id, event_type, priority, title, body, resource_type, "
            "resource_id, action_path, dedupe_key) VALUES (:recipient_user_id, :event_type, :priority, :title, "
            ":body, :resource_type, :resource_id, :action_path, :dedupe_key)"
        ),
        values,
    )


@pytest.mark.parametrize(
    "overrides, constraint",
    [
        ({"priority": "CRITICAL"}, "ck_notifications_priority"),
        ({"event_type": "SOMETHING_MADE_UP"}, "ck_notifications_event_type"),
        ({"resource_type": "task"}, "ck_notifications_resource_pair"),
        ({"action_path": "https://evil.example"}, "ck_notifications_action_path_relative"),
        ({"action_path": "//evil.example"}, "ck_notifications_action_path_relative"),
    ],
)
def test_check_constraints_reject_bad_rows(researcher, overrides, constraint):
    with pytest.raises(IntegrityError, match=constraint):
        with engine.begin() as conn:
            _insert(conn, researcher.user_id, **overrides)


def test_deleting_a_user_deletes_their_notifications(researcher):
    with engine.begin() as conn:
        _insert(conn, researcher.user_id)
        conn.execute(text("DELETE FROM users WHERE user_id = :u"), {"u": researcher.user_id})
        assert conn.scalar(text("SELECT count(*) FROM notifications")) == 0
