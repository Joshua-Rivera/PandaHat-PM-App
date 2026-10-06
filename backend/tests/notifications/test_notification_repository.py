import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.notifications.domain.event_types import EventType, Priority
from app.notifications.domain.events import InAppContent
from app.notifications.persistence import notification_repository as repo
from app.notifications.persistence.models import Notification

T0 = datetime(2026, 10, 5, 12, 0, tzinfo=UTC)


def _insert(db, user, *, key=None, title="t"):
    return repo.insert_notification_if_absent(
        db,
        recipient_user_id=user.user_id,
        actor_user_id=None,
        event_type=EventType.TASK_ASSIGNED,
        priority=Priority.NORMAL,
        content=InAppContent(title=title, body="b"),
        dedupe_key=key or str(uuid.uuid4()),
    )


def _insert_at(db, user, created_at, title):
    notification_id = _insert(db, user, title=title)
    db.execute(update(Notification).where(Notification.notification_id == notification_id).values(created_at=created_at))
    db.commit()
    return notification_id


def test_insert_returns_new_id(db, researcher):
    assert isinstance(_insert(db, researcher), int)


def test_duplicate_dedupe_key_returns_none_and_keeps_one_row(db, researcher):
    first = _insert(db, researcher, key="same")
    second = _insert(db, researcher, key="same")
    db.commit()
    assert first is not None and second is None
    assert repo.count_unread_notifications(db, researcher.user_id) == 1


def test_same_dedupe_key_for_different_users_is_allowed(db, researcher, other_researcher):
    assert _insert(db, researcher, key="same") is not None
    assert _insert(db, other_researcher, key="same") is not None


def test_list_is_newest_first(db, researcher):
    for i in range(3):
        _insert_at(db, researcher, T0 + timedelta(minutes=i), f"n{i}")
    page = repo.list_notifications_for_user(db, researcher.user_id, cursor=None, limit=10, unread_only=False)
    assert [n.title for n in page.items] == ["n2", "n1", "n0"]
    assert page.next_cursor is None


def test_keyset_pagination_covers_everything_once_even_with_equal_timestamps(db, researcher):
    # 5 rows share one timestamp: only the notification_id tiebreaker keeps pages stable.
    ids = {_insert_at(db, researcher, T0, f"same{i}") for i in range(5)}
    ids |= {_insert_at(db, researcher, T0 - timedelta(hours=1), "older")}
    seen, cursor = [], None
    while True:
        page = repo.list_notifications_for_user(db, researcher.user_id, cursor=cursor, limit=2, unread_only=False)
        seen += [n.notification_id for n in page.items]
        cursor = page.next_cursor
        if cursor is None:
            break
    assert len(seen) == len(set(seen)) == 6
    assert set(seen) == ids


def test_list_only_returns_my_notifications(db, researcher, other_researcher):
    _insert(db, other_researcher)
    db.commit()
    page = repo.list_notifications_for_user(db, researcher.user_id, cursor=None, limit=10, unread_only=False)
    assert page.items == []


def test_unread_only_filter_and_count(db, researcher):
    read_id = _insert(db, researcher)
    _insert(db, researcher)
    repo.set_notification_read_state(db, researcher.user_id, read_id, is_read=True, now=T0)
    db.commit()
    page = repo.list_notifications_for_user(db, researcher.user_id, cursor=None, limit=10, unread_only=True)
    assert len(page.items) == 1
    assert repo.count_unread_notifications(db, researcher.user_id) == 1


def test_read_state_round_trip_and_first_read_time_is_kept(db, researcher):
    nid = _insert(db, researcher)
    assert repo.set_notification_read_state(db, researcher.user_id, nid, is_read=True, now=T0).read_at == T0
    later = T0 + timedelta(hours=1)
    assert repo.set_notification_read_state(db, researcher.user_id, nid, is_read=True, now=later).read_at == T0
    assert repo.set_notification_read_state(db, researcher.user_id, nid, is_read=False, now=later).read_at is None


def test_cannot_touch_another_users_notification(db, researcher, other_researcher):
    nid = _insert(db, other_researcher)
    db.commit()
    assert repo.get_notification_for_user(db, researcher.user_id, nid) is None
    assert repo.set_notification_read_state(db, researcher.user_id, nid, is_read=True, now=T0) is None


def test_mark_all_read_respects_read_before(db, researcher):
    _insert_at(db, researcher, T0, "seen")
    _insert_at(db, researcher, T0 + timedelta(seconds=5), "arrived after click")
    updated = repo.mark_all_notifications_read(db, researcher.user_id, read_before=T0, now=T0)
    db.commit()
    assert updated == 1
    assert repo.count_unread_notifications(db, researcher.user_id) == 1
