"""Test fixtures. Tests run against a REAL Postgres, because the features under
test (ON CONFLICT, partial indexes, CHECK constraints) are Postgres behaviour
that SQLite would silently fake or reject.

Set TEST_DATABASE_URL, e.g. postgresql+psycopg://localhost:5432/pandahat_test
(`docker compose up -d db` provides one; see README).
"""

import os
import uuid

TEST_DATABASE_URL = os.environ.setdefault(
    "TEST_DATABASE_URL", "postgresql+psycopg://pandahat:pandahat@localhost:5432/pandahat_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL  # must happen before app.db is imported

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal, engine
from app.main import app
from app.research.models import Project, Task
from app.users.models import User


@pytest.fixture(scope="session")
def migrated_database():
    """Build the schema exactly as production would: by running the migrations."""
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
    cfg = Config("alembic.ini")
    cfg.attributes["database_url"] = TEST_DATABASE_URL
    command.upgrade(cfg, "head")
    yield


@pytest.fixture
def clean_db(migrated_database):
    """Any test that touches the database depends on this (directly or via db/client)."""
    yield
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE user_identities, notifications, learning_task_completions, learning_path_enrollments, learning_tasks, "
                "learning_modules, learning_paths, availability_blocks, project_members, tasks, projects, users "
                "RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture
def db(clean_db):
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def client(clean_db):
    return TestClient(app)


def _make_user(db, name: str, role: str = "researcher", **kwargs) -> User:
    user = User(user_id=uuid.uuid4(), display_name=name, email=f"{name.lower()}@pandahat.test", role=role, **kwargs)
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def researcher(db) -> User:
    return _make_user(db, "Joshua", is_email_verified=True)


@pytest.fixture
def other_researcher(db) -> User:
    return _make_user(db, "Ada")


@pytest.fixture
def pm(db) -> User:
    return _make_user(db, "Priya", role="pm")


@pytest.fixture
def task(db) -> Task:
    project = Project(project_id=uuid.uuid4(), name="Watermark Robustness")
    task = Task(task_id=uuid.uuid4(), project_id=project.project_id, title="Evaluate TrustMark after JPEG compression")
    db.add_all([project, task])
    db.commit()
    return task


def auth(user: User) -> dict[str, str]:
    return {"X-Dev-User-Id": str(user.user_id)}
