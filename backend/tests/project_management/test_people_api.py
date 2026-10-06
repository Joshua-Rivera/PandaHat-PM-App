"""Team, availability, learning paths, dashboards and the dev identity switcher."""

import pytest

from app.config import Settings
from tests.conftest import auth

pytestmark = pytest.mark.usefixtures("clean_db")

NOTIFS = "/api/v1/me/notifications"


def _availability(client, user, blocks):
    return client.put("/api/v1/me/availability", json={"blocks": blocks}, headers=auth(user))


def test_availability_persists_and_drives_capacity(client, pm, researcher):
    r = _availability(client, researcher, [
        {"weekday": 0, "start_time": "15:00", "end_time": "18:00"},
        {"weekday": 2, "start_time": "13:00", "end_time": "17:00"},
    ])
    assert r.status_code == 200 and r.json()["weekly_capacity_hours"] == 7
    again = client.get("/api/v1/me/availability", headers=auth(researcher)).json()
    assert [(b["weekday"], b["start_time"]) for b in again["blocks"]] == [(0, "15:00:00"), (2, "13:00:00")]

    project = client.post("/api/v1/projects", json={"name": "P"}, headers=auth(pm)).json()
    client.post("/api/v1/tasks", json={"title": "T", "project_id": project["project_id"], "estimated_hours": 5,
                                       "assignee_user_id": str(researcher.user_id)}, headers=auth(pm))
    [me] = client.get("/api/v1/researchers", headers=auth(pm)).json()
    assert me["workload"] == {
        "capacity_hours": 7.0, "assigned_hours": 5.0, "open_task_count": 1, "capacity_state": "AVAILABLE",
        "committed_hours": 5.0, "below_commitment": False,
    }


def test_availability_rejects_overlaps_and_backwards_blocks(client, researcher):
    overlap = _availability(client, researcher, [
        {"weekday": 1, "start_time": "09:00", "end_time": "12:00"},
        {"weekday": 1, "start_time": "11:00", "end_time": "13:00"},
    ])
    assert overlap.status_code == 422 and "overlap" in overlap.text
    backwards = _availability(client, researcher, [{"weekday": 1, "start_time": "12:00", "end_time": "09:00"}])
    assert backwards.status_code == 422


def test_pm_adds_team_member_and_researcher_cannot(client, pm, researcher):
    body = {"display_name": "Researcher C", "email": "c@pandahat.dev", "research_status": "RESEARCH", "commitment": "FULL_TIME"}
    created = client.post("/api/v1/users", json=body, headers=auth(pm))
    assert created.status_code == 201 and created.json()["role"] == "researcher"
    assert client.post("/api/v1/users", json=body, headers=auth(pm)).status_code == 409
    assert client.post("/api/v1/users", json=body | {"email": "d@pandahat.dev"}, headers=auth(researcher)).status_code == 403
    assert client.post("/api/v1/users", json=body | {"email": "e@pandahat.dev", "role": "admin"}, headers=auth(pm)).status_code == 403


def test_research_ready_notifies_researcher_once(client, pm, researcher):
    url = f"/api/v1/researchers/{researcher.user_id}"
    for status in ("RESEARCH", "LEARNING_PATH", "RESEARCH"):
        assert client.patch(url, json={"research_status": status}, headers=auth(pm)).status_code == 200
    types = [n["event_type"] for n in client.get(NOTIFS, headers=auth(researcher)).json()["items"]]
    assert types == ["RESEARCH_READY"]


def test_researcher_can_view_only_own_profile(client, researcher, other_researcher):
    assert client.get(f"/api/v1/researchers/{researcher.user_id}", headers=auth(researcher)).status_code == 200
    assert client.get(f"/api/v1/researchers/{other_researcher.user_id}", headers=auth(researcher)).status_code == 404


LEARNING_PATH = {
    "name": "Computer Vision Foundations",
    "modules": [
        {"title": "Python Fundamentals", "tasks": [{"title": "Python crash course", "estimated_hours": 2}]},
        {"title": "Digital Watermarking", "tasks": [
            {"title": "Read TrustMark paper", "resource_url": "https://arxiv.org/abs/2311.18297"},
            {"title": "Summarize the paper"},
        ]},
    ],
}


def test_learning_path_lifecycle(client, pm, researcher):
    assert client.get("/api/v1/me/learning-path", headers=auth(researcher)).json() == {"enrollment": None}
    path = client.post("/api/v1/learning-paths", json=LEARNING_PATH, headers=auth(pm)).json()
    assert path["total_task_count"] == 3

    r = client.put(f"/api/v1/researchers/{researcher.user_id}/learning-path",
                   json={"learning_path_id": path["learning_path_id"]}, headers=auth(pm))
    assert r.status_code == 200
    assert client.get(NOTIFS, headers=auth(researcher)).json()["items"][0]["event_type"] == "LEARNING_TASK_ASSIGNED"

    mine = client.get("/api/v1/me/learning-path", headers=auth(researcher)).json()["enrollment"]
    assert mine["current_task"]["title"] == "Python crash course" and mine["progress_percent"] == 0
    task_ids = [t["learning_task_id"] for m in mine["modules"] for t in m["tasks"]]
    for task_id in task_ids:
        mine = client.put(f"/api/v1/me/learning-tasks/{task_id}/completion", json={"is_completed": True},
                          headers=auth(researcher)).json()["enrollment"]
    assert mine["progress_percent"] == 100 and mine["completed_at"] is not None and mine["current_task"] is None
    assert [m["state"] for m in mine["modules"]] == ["COMPLETED", "COMPLETED"]
    # Finishing the path tells the PMs.
    assert client.get(NOTIFS, headers=auth(pm)).json()["items"][0]["event_type"] == "LEARNING_PATH_COMPLETED"
    # Managers see enrolment progress; researchers can't manage paths.
    detail = client.get(f"/api/v1/learning-paths/{path['learning_path_id']}", headers=auth(pm)).json()
    assert detail["enrollments"][0]["progress_percent"] == 100
    assert client.post("/api/v1/learning-paths", json=LEARNING_PATH | {"name": "Z"}, headers=auth(researcher)).status_code == 403


def test_dashboards(client, pm, researcher):
    _availability(client, researcher, [{"weekday": 0, "start_time": "09:00", "end_time": "11:00"}])
    project = client.post("/api/v1/projects", json={"name": "P"}, headers=auth(pm)).json()
    client.post("/api/v1/tasks", json={"title": "Big", "project_id": project["project_id"], "estimated_hours": 6,
                                       "status": "BLOCKED", "assignee_user_id": str(researcher.user_id)}, headers=auth(pm))
    mine = client.get("/api/v1/me/dashboard", headers=auth(researcher)).json()
    assert mine["current_project"]["name"] == "P" and len(mine["open_tasks"]) == 1
    assert mine["workload"]["capacity_state"] == "OVERLOADED"

    overview = client.get("/api/v1/overview", headers=auth(pm)).json()
    assert overview["researcher_count"] == 1 and overview["assigned_hours_total"] == 6
    attention = overview["needs_attention"]
    assert [r["display_name"] for r in attention["overloaded_researchers"]] == ["Joshua"]
    assert [t["title"] for t in attention["blocked_tasks"]] == ["Big"]


def test_dev_bootstrap_only_on_empty_database(client):
    r = client.post("/api/v1/dev/bootstrap", json={"display_name": "First PM", "email": "pm@pandahat.dev"})
    assert r.status_code == 201 and r.json()["role"] == "pm"
    assert [u["display_name"] for u in client.get("/api/v1/dev/identities").json()] == ["First PM"]
    assert client.post("/api/v1/dev/bootstrap", json={"display_name": "Again", "email": "b@pandahat.dev"}).status_code == 409


def test_dev_auth_cannot_be_enabled_in_production():
    with pytest.raises(ValueError, match="not allowed"):
        Settings(ENVIRONMENT="production", AUTH_MODE="dev")
