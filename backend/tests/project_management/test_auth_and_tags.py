"""Firebase sign-in (token verification mocked), PM approval, member tags and the team availability table."""

from types import SimpleNamespace

import pytest

from app import auth as auth_module
from app import identity
from app.users.models import User
from tests.conftest import auth

BEARER = {"Authorization": "Bearer test-token"}


@pytest.fixture
def firebase(monkeypatch):
    """Switch the API to AUTH_MODE=firebase and let each test choose the token's claims."""
    claims: dict = {}
    monkeypatch.setattr(auth_module, "get_settings", lambda: SimpleNamespace(is_dev_auth=False))

    def fake_verify(token: str):
        if token != "test-token":
            raise identity.InvalidTokenError("bad")
        return identity.claims_from_dict(claims)

    monkeypatch.setattr(identity, "verify_firebase_token", fake_verify)
    monkeypatch.setattr(identity, "bootstrap_admin_emails", lambda: set())

    def sign_in_as(uid: str, email: str | None, github_id: int, name: str = "Octo Cat"):
        claims.clear()
        claims.update(
            sub=uid,
            email=email,
            email_verified=False,
            name=name,
            picture="https://avatars.githubusercontent.com/u/1",
            firebase={"sign_in_provider": "github.com", "identities": {"github.com": [str(github_id)]}},
        )

    return sign_in_as


def test_missing_or_bad_token_is_401(client, firebase, pm):
    assert client.get("/api/v1/me").status_code == 401
    assert client.get("/api/v1/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_first_ever_sign_in_becomes_admin(client, firebase, migrated_database, clean_db):
    firebase("uid-1", "founder@pandahat.test", 1)
    me = client.get("/api/v1/me", headers=BEARER).json()
    assert me["role"] == "admin" and me["access_status"] == "APPROVED"


def test_known_email_links_to_existing_member(client, firebase, researcher):
    firebase("uid-joshua", researcher.email.upper(), 42)
    me = client.get("/api/v1/me", headers=BEARER).json()
    assert me["user_id"] == str(researcher.user_id) and me["access_status"] == "APPROVED"
    # Same GitHub account, new Firebase uid (e.g. project recreated): still the same person.
    firebase("uid-joshua-2", None, 42)
    assert client.get("/api/v1/me", headers=BEARER).json()["user_id"] == str(researcher.user_id)


def test_unknown_account_waits_for_pm_approval(client, firebase, pm, db):
    firebase("uid-new", "stranger@example.com", 7, name="New Person")
    me = client.get("/api/v1/me", headers=BEARER)
    assert me.status_code == 200 and me.json()["access_status"] == "PENDING"
    assert client.get("/api/v1/me/dashboard", headers=BEARER).status_code == 403
    assert client.post("/api/v1/auth/github-login", json={"login": "new-person"}, headers=BEARER).status_code == 204

    # The PM sees and approves the request (dev header for the PM; the dependency is mocked to firebase,
    # so sign the PM in through a linked identity instead).
    new_id = me.json()["user_id"]
    firebase("uid-pm", pm.email, 99)
    pending = client.get("/api/v1/users/pending", headers=BEARER).json()
    assert [(p["user_id"], p["github_login"]) for p in pending] == [(new_id, "new-person")]
    body = {"research_status": "RESEARCH", "commitment": "FULL_TIME"}
    assert client.post(f"/api/v1/users/{new_id}/approve", json=body, headers=BEARER).status_code == 204
    assert client.post(f"/api/v1/users/{new_id}/approve", json=body, headers=BEARER).status_code == 409

    firebase("uid-new", "stranger@example.com", 7)
    me = client.get("/api/v1/me", headers=BEARER).json()
    assert (me["access_status"], me["research_status"], me["commitment"], me["committed_hours"]) == (
        "APPROVED", "RESEARCH", "FULL_TIME", 10.0
    )
    assert client.get("/api/v1/me/dashboard", headers=BEARER).status_code == 200


def test_rejected_request_cannot_sign_in(client, firebase, pm, db):
    firebase("uid-x", "x@example.com", 8)
    new_id = client.get("/api/v1/me", headers=BEARER).json()["user_id"]
    firebase("uid-pm", pm.email, 99)
    assert client.post(f"/api/v1/users/{new_id}/reject", headers=BEARER).status_code == 204
    firebase("uid-x", "x@example.com", 8)
    assert client.get("/api/v1/me", headers=BEARER).status_code == 403


def test_researchers_cannot_approve(client, pm, researcher, db):
    pending = User(display_name="P", email="p@example.com", access_status="PENDING")
    db.add(pending)
    db.commit()
    assert client.get("/api/v1/users/pending", headers=auth(researcher)).status_code == 403
    assert client.post(f"/api/v1/users/{pending.user_id}/approve", json={}, headers=auth(researcher)).status_code == 403
    # Pending people are not on the team or in pickers.
    names = [u["display_name"] for u in client.get("/api/v1/users", headers=auth(pm)).json()]
    assert "P" not in names


def test_commitment_sets_committed_hours_and_flags_shortfall(client, pm, researcher):
    url = f"/api/v1/researchers/{researcher.user_id}"
    r = client.patch(url, json={"commitment": "FULL_TIME"}, headers=auth(pm)).json()["researcher"]
    assert r["commitment"] == "FULL_TIME"
    assert (r["workload"]["committed_hours"], r["workload"]["below_commitment"]) == (10.0, True)
    blocks = [{"weekday": 0, "start_time": "09:00", "end_time": "14:00"}, {"weekday": 2, "start_time": "09:00", "end_time": "14:00"}]
    client.put("/api/v1/me/availability", json={"blocks": blocks}, headers=auth(researcher))
    r = client.get(url, headers=auth(pm)).json()["researcher"]
    assert r["workload"]["below_commitment"] is False
    assert client.patch(url, json={"commitment": "PART_TIME"}, headers=auth(pm)).status_code == 422


def test_team_availability_table_is_pm_only(client, pm, researcher, other_researcher):
    blocks = [{"weekday": 1, "start_time": "15:00", "end_time": "18:00"}]
    client.put("/api/v1/me/availability", json={"blocks": blocks}, headers=auth(researcher))
    rows = client.get("/api/v1/availability/team", headers=auth(pm)).json()
    by_name = {r["display_name"]: r for r in rows}
    assert set(by_name) == {"Joshua", "Ada", "Priya"}
    assert by_name["Joshua"]["weekly_capacity_hours"] == 3.0
    assert by_name["Joshua"]["blocks"] == [{"weekday": 1, "start_time": "15:00:00", "end_time": "18:00:00"}]
    assert by_name["Ada"]["committed_hours"] == 5.0
    assert client.get("/api/v1/availability/team", headers=auth(researcher)).status_code == 403
