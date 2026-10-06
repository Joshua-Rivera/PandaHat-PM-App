"""Create the minimal PandaHat core tables: users, projects, tasks.

Revision ID: 0001
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE users (
      user_id            UUID        NOT NULL,
      display_name       TEXT        NOT NULL,
      email              TEXT        NOT NULL,
      is_email_verified  BOOLEAN     NOT NULL DEFAULT false,
      role               TEXT        NOT NULL DEFAULT 'researcher',
      is_active          BOOLEAN     NOT NULL DEFAULT true,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT pk_users PRIMARY KEY (user_id),
      CONSTRAINT uq_users_email UNIQUE (email),
      CONSTRAINT ck_users_role CHECK (role IN ('researcher', 'pm', 'admin'))
    )""")
    op.execute("""
    CREATE TABLE projects (
      project_id  UUID NOT NULL,
      name        TEXT NOT NULL,
      CONSTRAINT pk_projects PRIMARY KEY (project_id)
    )""")
    op.execute("""
    CREATE TABLE tasks (
      task_id             UUID         NOT NULL,
      project_id          UUID         NOT NULL,
      title               TEXT         NOT NULL,
      description         TEXT         NOT NULL DEFAULT '',
      assignee_user_id    UUID         NULL,
      assignment_version  INTEGER      NOT NULL DEFAULT 0,
      deadline_at         TIMESTAMPTZ  NULL,
      estimated_hours     NUMERIC(5,1) NULL,
      CONSTRAINT pk_tasks PRIMARY KEY (task_id),
      CONSTRAINT fk_tasks_project_id FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
      CONSTRAINT fk_tasks_assignee_user_id FOREIGN KEY (assignee_user_id) REFERENCES users(user_id) ON DELETE SET NULL
    )""")
    op.execute("CREATE INDEX ix_tasks_assignee_user_id ON tasks (assignee_user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE tasks")
    op.execute("DROP TABLE projects")
    op.execute("DROP TABLE users")
