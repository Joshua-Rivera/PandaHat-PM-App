"""The core PandaHat workflow, driven only through the HTTP API (what the UI does)."""

from datetime import UTC, datetime, timedelta

import pytest

from tests.conftest import auth

pytestmark = pytest.mark.usefixtures("clean_db")

NOTIFS = "/api/v1/me/notifications"


def _create_project(client, pm, **overrides):
    body = {"name": "Watermark Robustness Against Face Swaps", "research_question": "Can TrustMark survive face swaps?"}
    r = client.post("/api/v1/projects", json=body | overrides, headers=auth(pm))
    assert r.status_code == 201, r.text
    return r.json()


def _create_task(client, pm, project_id, **overrides):
    body = {"title": "Analyze SimSwap results", "project_id": project_id}
    r = client.post("/api/v1/tasks", json=body | overrides, headers=auth(pm))
    assert r.status_code == 201, r.text
    return r.json()


def test_pm_creates_project_and_it_is_listed(client, pm):
    project = _create_project(client, pm, stage="EXPERIMENT_VALIDATION", github_repository="Adversarial-Fall-2026/Watermarking")
    assert project["project_manager"]["user_id"] == str(pm.user_id)  # defaults to the creator
    assert project["viewer_can_manage"] is True
    listed = client.get("/api/v1/projects", headers=auth(pm)).json()
    assert [p["name"] for p in listed] == ["Watermark Robustness Against Face Swaps"]


def test_project_validation_errors_are_field_specific(client, pm):
    _create_project(client, pm)
    dup = client.post("/api/v1/projects", json={"name": "watermark robustness against face swaps"}, headers=auth(pm))
    assert dup.status_code == 409 and dup.json()["field"] == "name"
    bad_dates = client.post(
        "/api/v1/projects", json={"name": "X", "start_date": "2026-10-10", "target_date": "2026-10-01"}, headers=auth(pm)
    )
    assert bad_dates.status_code == 422
    bad_repo = client.post("/api/v1/projects", json={"name": "Y", "github_repository": "not a repo"}, headers=auth(pm))
    assert bad_repo.status_code == 422


def test_pm_creates_assigned_task_and_researcher_is_notified(client, pm, researcher):
    project = _create_project(client, pm)
    deadline = (datetime.now(UTC) + timedelta(days=3)).isoformat()
    task = _create_task(
        client, pm, project["project_id"],
        assignee_user_id=str(researcher.user_id), priority="HIGH", estimated_hours=3, deadline_at=deadline,
    )
    assert task["assignee"]["display_name"] == "Joshua"
    assert task["status"] == "TODO" and task["priority"] == "HIGH" and task["estimated_hours"] == 3

    # Researcher: sees it under My Work …
    mine = client.get("/api/v1/tasks", params={"assignee": "me"}, headers=auth(researcher)).json()
    assert [t["task_id"] for t in mine] == [task["task_id"]]
    assert mine[0]["viewer_can_update_status"] is True and mine[0]["viewer_can_manage"] is False
    # … got a notification that links to it …
    [notification] = client.get(NOTIFS, headers=auth(researcher)).json()["items"]
    assert notification["event_type"] == "TASK_ASSIGNED"
    assert notification["action_path"] == f"/projects/{project['project_id']}/tasks/{task['task_id']}"
    # … and became a member of the project, so the project is visible to them.
    assert [p["project_id"] for p in client.get("/api/v1/projects", headers=auth(researcher)).json()] == [project["project_id"]]

    # Mark as read → unread count drops.
    assert client.get(f"{NOTIFS}/unread-count", headers=auth(researcher)).json()["unread_count"] == 1
    client.patch(f"{NOTIFS}/{notification['notification_id']}", json={"is_read": True}, headers=auth(researcher))
    assert client.get(f"{NOTIFS}/unread-count", headers=auth(researcher)).json()["unread_count"] == 0


def test_reassigning_via_patch_notifies_both_people(client, pm, researcher, other_researcher):
    project = _create_project(client, pm)
    task = _create_task(client, pm, project["project_id"], assignee_user_id=str(researcher.user_id))
    r = client.patch(f"/api/v1/tasks/{task['task_id']}", json={"assignee_user_id": str(other_researcher.user_id)}, headers=auth(pm))
    assert r.status_code == 200 and r.json()["assignment_version"] == 2
    joshua = [n["event_type"] for n in client.get(NOTIFS, headers=auth(researcher)).json()["items"]]
    ada = [n["event_type"] for n in client.get(NOTIFS, headers=auth(other_researcher)).json()["items"]]
    assert joshua == ["TASK_UNASSIGNED", "TASK_ASSIGNED"]
    assert ada == ["TASK_ASSIGNED"]


def test_deadline_change_notifies_assignee(client, pm, researcher):
    project = _create_project(client, pm)
    task = _create_task(client, pm, project["project_id"], assignee_user_id=str(researcher.user_id))
    new_deadline = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    client.patch(f"/api/v1/tasks/{task['task_id']}", json={"deadline_at": new_deadline}, headers=auth(pm))
    types = [n["event_type"] for n in client.get(NOTIFS, headers=auth(researcher)).json()["items"]]
    assert types == ["DEADLINE_CHANGED", "TASK_ASSIGNED"]


def test_researcher_can_move_own_task_through_statuses(client, pm, researcher):
    project = _create_project(client, pm)
    task = _create_task(client, pm, project["project_id"], assignee_user_id=str(researcher.user_id))
    url = f"/api/v1/tasks/{task['task_id']}"
    assert client.patch(url, json={"status": "IN_PROGRESS"}, headers=auth(researcher)).json()["status"] == "IN_PROGRESS"
    done = client.patch(url, json={"status": "COMPLETED"}, headers=auth(researcher)).json()
    assert done["status"] == "COMPLETED" and done["completed_at"] is not None
    reopened = client.patch(url, json={"status": "TODO"}, headers=auth(researcher)).json()
    assert reopened["completed_at"] is None


def test_researcher_cannot_do_pm_only_operations(client, pm, researcher, other_researcher):
    project = _create_project(client, pm)
    task = _create_task(client, pm, project["project_id"], assignee_user_id=str(researcher.user_id))
    h = auth(researcher)
    assert client.post("/api/v1/projects", json={"name": "Mine"}, headers=h).status_code == 403
    assert client.patch(f"/api/v1/projects/{project['project_id']}", json={"name": "Renamed"}, headers=h).status_code == 403
    assert client.post("/api/v1/tasks", json={"title": "x", "project_id": project["project_id"]}, headers=h).status_code == 403
    # Assignee may change status only.
    r = client.patch(f"/api/v1/tasks/{task['task_id']}", json={"title": "Easier task", "estimated_hours": 0}, headers=h)
    assert r.status_code == 403 and "estimated hours" in r.json()["detail"].replace("_", " ")
    # No self-assigning, no joining projects.
    assert client.put(f"/api/v1/tasks/{task['task_id']}/assignee", json={"assignee_user_id": str(researcher.user_id)}, headers=h).status_code == 403
    assert client.post(f"/api/v1/projects/{project['project_id']}/members", json={"user_id": str(researcher.user_id)}, headers=h).status_code == 403
    assert client.get("/api/v1/researchers", headers=h).status_code == 403
    assert client.get("/api/v1/overview", headers=h).status_code == 403
    assert client.delete(f"/api/v1/tasks/{task['task_id']}", headers=h).status_code == 403


def test_researcher_cannot_see_projects_they_are_not_on(client, pm, researcher, other_researcher):
    project = _create_project(client, pm)
    task = _create_task(client, pm, project["project_id"], assignee_user_id=str(other_researcher.user_id))
    assert client.get("/api/v1/projects", headers=auth(researcher)).json() == []
    assert client.get(f"/api/v1/projects/{project['project_id']}", headers=auth(researcher)).status_code == 404
    assert client.get(f"/api/v1/tasks/{task['task_id']}", headers=auth(researcher)).status_code == 404
    # …and cannot change a teammate's task even when they can see it.
    client.post(f"/api/v1/projects/{project['project_id']}/members", json={"user_id": str(researcher.user_id)}, headers=auth(pm))
    r = client.patch(f"/api/v1/tasks/{task['task_id']}", json={"status": "COMPLETED"}, headers=auth(researcher))
    assert r.status_code == 403


def test_project_membership_notifies_and_blocks_removal_with_open_tasks(client, pm, researcher):
    project = _create_project(client, pm)
    pid = project["project_id"]
    detail = client.post(f"/api/v1/projects/{pid}/members", json={"user_id": str(researcher.user_id)}, headers=auth(pm)).json()
    assert [m["display_name"] for m in detail["members"]] == ["Joshua"]
    assert client.get(NOTIFS, headers=auth(researcher)).json()["items"][0]["event_type"] == "PROJECT_ASSIGNED"
    task = _create_task(client, pm, pid, assignee_user_id=str(researcher.user_id))
    assert client.delete(f"/api/v1/projects/{pid}/members/{researcher.user_id}", headers=auth(pm)).status_code == 409
    client.patch(f"/api/v1/tasks/{task['task_id']}", json={"status": "COMPLETED"}, headers=auth(pm))
    assert client.delete(f"/api/v1/projects/{pid}/members/{researcher.user_id}", headers=auth(pm)).status_code == 200


def test_project_stats_and_archiving(client, pm, researcher):
    project = _create_project(client, pm)
    pid = project["project_id"]
    a = _create_task(client, pm, pid, title="A")
    _create_task(client, pm, pid, title="B", status="BLOCKED")
    client.patch(f"/api/v1/tasks/{a['task_id']}", json={"status": "COMPLETED"}, headers=auth(pm))
    stats = client.get(f"/api/v1/projects/{pid}", headers=auth(pm)).json()["stats"]
    assert stats["progress_percent"] == 50 and stats["blocked_task_count"] == 1 and stats["open_task_count"] == 1
    assert client.delete(f"/api/v1/tasks/{a['task_id']}", headers=auth(pm)).status_code == 204
    assert [t["title"] for t in client.get("/api/v1/tasks", params={"project_id": pid}, headers=auth(pm)).json()] == ["B"]


def test_github_linked_task_source_follows_issue_url(client, pm):
    project = _create_project(client, pm)
    task = _create_task(client, pm, project["project_id"], github_issue_url="https://github.com/org/repo/issues/12")
    assert task["source"] == "GITHUB_LINKED"
    r = client.patch(f"/api/v1/tasks/{task['task_id']}", json={"github_issue_url": None}, headers=auth(pm))
    assert r.json()["source"] == "LOCAL"
    bad = client.post("/api/v1/tasks", json={"title": "x", "project_id": project["project_id"], "github_issue_url": "http://evil"}, headers=auth(pm))
    assert bad.status_code == 422
