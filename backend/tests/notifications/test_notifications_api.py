from datetime import UTC, datetime, timedelta

from app.db import SessionLocal
from app.notifications.services.emit import emit_notification_event
from tests.conftest import auth
from tests.notifications.factories import task_assigned_event

BASE = "/api/v1/me/notifications"


def _notify(user, version=1):
    return emit_notification_event(task_assigned_event(user.user_id, version=version), SessionLocal)[0]


def test_requires_authentication(client):
    assert client.get(BASE).status_code == 401


def test_list_and_unread_count(client, researcher):
    _notify(researcher, 1)
    _notify(researcher, 2)
    body = client.get(BASE, headers=auth(researcher)).json()
    assert len(body["items"]) == 2 and body["next_cursor"] is None
    assert body["items"][0]["is_read"] is False
    assert client.get(f"{BASE}/unread-count", headers=auth(researcher)).json() == {"unread_count": 2}


def test_pagination_via_cursor(client, researcher):
    for v in range(1, 4):
        _notify(researcher, v)
    first = client.get(BASE, params={"limit": 2}, headers=auth(researcher)).json()
    second = client.get(BASE, params={"limit": 2, "cursor": first["next_cursor"]}, headers=auth(researcher)).json()
    assert len(first["items"]) == 2 and len(second["items"]) == 1 and second["next_cursor"] is None


def test_bad_cursor_is_400(client, researcher):
    assert client.get(BASE, params={"cursor": "garbage"}, headers=auth(researcher)).status_code == 400


def test_mark_read_and_unread(client, researcher):
    nid = _notify(researcher)
    r = client.patch(f"{BASE}/{nid}", json={"is_read": True}, headers=auth(researcher))
    assert r.status_code == 200 and r.json()["is_read"] is True
    assert client.get(f"{BASE}/unread-count", headers=auth(researcher)).json()["unread_count"] == 0
    r = client.patch(f"{BASE}/{nid}", json={"is_read": False}, headers=auth(researcher))
    assert r.json()["is_read"] is False


def test_other_users_notification_is_404_not_403(client, researcher, other_researcher):
    nid = _notify(other_researcher)
    assert client.get(f"{BASE}/{nid}", headers=auth(researcher)).status_code == 404
    assert client.patch(f"{BASE}/{nid}", json={"is_read": True}, headers=auth(researcher)).status_code == 404


def test_mark_all_read(client, researcher):
    _notify(researcher, 1)
    _notify(researcher, 2)
    read_before = (datetime.now(UTC) + timedelta(seconds=1)).isoformat()
    r = client.post(f"{BASE}/mark-all-read", json={"read_before": read_before}, headers=auth(researcher))
    assert r.json() == {"updated_count": 2}


def test_assigning_a_task_notifies_the_assignee_end_to_end(client, pm, researcher, task):
    r = client.put(f"/api/v1/tasks/{task.task_id}/assignee", json={"assignee_user_id": str(researcher.user_id)}, headers=auth(pm))
    assert r.status_code == 200
    [item] = client.get(BASE, headers=auth(researcher)).json()["items"]
    assert item["event_type"] == "TASK_ASSIGNED"
    assert item["action_path"] == f"/projects/{task.project_id}/tasks/{task.task_id}"


def test_reassigning_to_same_person_does_not_duplicate(client, pm, researcher, task):
    for _ in range(2):
        client.put(f"/api/v1/tasks/{task.task_id}/assignee", json={"assignee_user_id": str(researcher.user_id)}, headers=auth(pm))
    assert client.get(f"{BASE}/unread-count", headers=auth(researcher)).json()["unread_count"] == 1


def test_researchers_cannot_assign_tasks(client, researcher, task):
    r = client.put(f"/api/v1/tasks/{task.task_id}/assignee", json={"assignee_user_id": str(researcher.user_id)}, headers=auth(researcher))
    assert r.status_code == 403
