"""Project-management domain: richer users/projects/tasks, project membership,
availability blocks and learning paths.

Revision ID: 0003

Existing rows keep working: every new NOT NULL column has a default.
CHECK lists are generated from the Python StrEnums (same pattern as 0002).
"""
from alembic import op

from app.research.domain import ProjectStage, TaskPriority, TaskSource, TaskStatus

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _sql_list(enum) -> str:
    return ", ".join(f"'{member.value}'" for member in enum)


def upgrade() -> None:
    # ── users: lifecycle status + skills ────────────────────────────────────
    op.execute(f"""
    ALTER TABLE users
      ADD COLUMN research_status TEXT   NOT NULL DEFAULT 'LEARNING_PATH',
      ADD COLUMN skills          TEXT[] NOT NULL DEFAULT '{{}}',
      ADD CONSTRAINT ck_users_research_status CHECK (research_status IN ('LEARNING_PATH', 'RESEARCH_READY', 'FULL_TIME')),
      ADD CONSTRAINT ck_users_display_name_length CHECK (char_length(display_name) BETWEEN 1 AND 120)
    """)

    # ── projects: research metadata, ownership, GitHub links ────────────────
    op.execute(f"""
    ALTER TABLE projects
      ADD COLUMN description              TEXT        NOT NULL DEFAULT '',
      ADD COLUMN research_question        TEXT        NOT NULL DEFAULT '',
      ADD COLUMN hypothesis               TEXT        NOT NULL DEFAULT '',
      ADD COLUMN research_track           TEXT        NOT NULL DEFAULT '',
      ADD COLUMN stage                    TEXT        NOT NULL DEFAULT 'PLANNING',
      ADD COLUMN project_manager_user_id  UUID        NULL,
      ADD COLUMN research_lead_user_id    UUID        NULL,
      ADD COLUMN start_date               DATE        NULL,
      ADD COLUMN target_date              DATE        NULL,
      ADD COLUMN github_repository        TEXT        NULL,
      ADD COLUMN github_project_url       TEXT        NULL,
      ADD COLUMN is_archived              BOOLEAN     NOT NULL DEFAULT false,
      ADD COLUMN created_by_user_id       UUID        NULL,
      ADD COLUMN created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      ADD CONSTRAINT fk_projects_project_manager_user_id FOREIGN KEY (project_manager_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_projects_research_lead_user_id   FOREIGN KEY (research_lead_user_id)   REFERENCES users(user_id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_projects_created_by_user_id      FOREIGN KEY (created_by_user_id)      REFERENCES users(user_id) ON DELETE SET NULL,
      ADD CONSTRAINT ck_projects_stage CHECK (stage IN ({_sql_list(ProjectStage)})),
      ADD CONSTRAINT ck_projects_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
      ADD CONSTRAINT ck_projects_dates_ordered CHECK (start_date IS NULL OR target_date IS NULL OR target_date >= start_date),
      ADD CONSTRAINT ck_projects_github_repository_format CHECK (github_repository IS NULL OR github_repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
      ADD CONSTRAINT ck_projects_github_project_url CHECK (github_project_url IS NULL OR github_project_url LIKE 'https://github.com/%')
    """)
    op.execute("CREATE UNIQUE INDEX uq_projects_name_lower ON projects (lower(name))")

    # ── project_members: who works on which project ─────────────────────────
    # Rows are soft-removed (removed_at) so membership_version survives
    # remove → re-add, which keeps PROJECT_ASSIGNED dedupe keys unique.
    op.execute("""
    CREATE TABLE project_members (
      project_id          UUID        NOT NULL,
      user_id             UUID        NOT NULL,
      membership_version  INTEGER     NOT NULL DEFAULT 1,
      added_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      removed_at          TIMESTAMPTZ NULL,
      CONSTRAINT pk_project_members PRIMARY KEY (project_id, user_id),
      CONSTRAINT fk_project_members_project_id FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
      CONSTRAINT fk_project_members_user_id    FOREIGN KEY (user_id)    REFERENCES users(user_id)       ON DELETE CASCADE
    )""")
    op.execute("CREATE INDEX ix_project_members_user_id ON project_members (user_id) WHERE removed_at IS NULL")
    # Anyone already assigned a task becomes a member of that task's project.
    op.execute("""
    INSERT INTO project_members (project_id, user_id)
    SELECT DISTINCT project_id, assignee_user_id FROM tasks WHERE assignee_user_id IS NOT NULL
    """)

    # ── tasks: workflow fields ──────────────────────────────────────────────
    op.execute(f"""
    ALTER TABLE tasks
      ADD COLUMN status              TEXT        NOT NULL DEFAULT 'TODO',
      ADD COLUMN priority            TEXT        NOT NULL DEFAULT 'MEDIUM',
      ADD COLUMN source              TEXT        NOT NULL DEFAULT 'LOCAL',
      ADD COLUMN github_issue_url    TEXT        NULL,
      ADD COLUMN required_skills     TEXT[]      NOT NULL DEFAULT '{{}}',
      ADD COLUMN is_archived         BOOLEAN     NOT NULL DEFAULT false,
      ADD COLUMN created_by_user_id  UUID        NULL,
      ADD COLUMN created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      ADD COLUMN updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      ADD COLUMN completed_at        TIMESTAMPTZ NULL,
      ADD CONSTRAINT fk_tasks_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
      ADD CONSTRAINT ck_tasks_status   CHECK (status   IN ({_sql_list(TaskStatus)})),
      ADD CONSTRAINT ck_tasks_priority CHECK (priority IN ({_sql_list(TaskPriority)})),
      ADD CONSTRAINT ck_tasks_source   CHECK (source   IN ({_sql_list(TaskSource)})),
      ADD CONSTRAINT ck_tasks_github_link_matches_source CHECK ((source = 'GITHUB_LINKED') = (github_issue_url IS NOT NULL)),
      ADD CONSTRAINT ck_tasks_github_issue_url CHECK (github_issue_url IS NULL OR github_issue_url LIKE 'https://github.com/%'),
      ADD CONSTRAINT ck_tasks_completed_at_matches_status CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)),
      ADD CONSTRAINT ck_tasks_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
      ADD CONSTRAINT ck_tasks_estimated_hours_non_negative CHECK (estimated_hours IS NULL OR estimated_hours >= 0)
    """)
    op.execute("CREATE INDEX ix_tasks_project_id ON tasks (project_id)")

    # ── availability_blocks: weekly recurring time a researcher can work ────
    op.execute("""
    CREATE TABLE availability_blocks (
      availability_block_id  BIGINT   GENERATED ALWAYS AS IDENTITY,
      user_id                UUID     NOT NULL,
      weekday                SMALLINT NOT NULL,   -- 0 = Monday … 6 = Sunday (ISO order)
      start_time             TIME     NOT NULL,
      end_time               TIME     NOT NULL,
      CONSTRAINT pk_availability_blocks PRIMARY KEY (availability_block_id),
      CONSTRAINT fk_availability_blocks_user_id FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      CONSTRAINT ck_availability_blocks_weekday CHECK (weekday BETWEEN 0 AND 6),
      CONSTRAINT ck_availability_blocks_time_order CHECK (end_time > start_time)
    )""")
    op.execute("CREATE INDEX ix_availability_blocks_user_id ON availability_blocks (user_id, weekday, start_time)")

    # ── learning paths: path → modules → tasks, plus per-user progress ──────
    op.execute("""
    CREATE TABLE learning_paths (
      learning_path_id    UUID        NOT NULL,
      name                TEXT        NOT NULL,
      description         TEXT        NOT NULL DEFAULT '',
      created_by_user_id  UUID        NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT pk_learning_paths PRIMARY KEY (learning_path_id),
      CONSTRAINT fk_learning_paths_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
      CONSTRAINT ck_learning_paths_name_length CHECK (char_length(name) BETWEEN 1 AND 120)
    )""")
    op.execute("CREATE UNIQUE INDEX uq_learning_paths_name_lower ON learning_paths (lower(name))")
    op.execute("""
    CREATE TABLE learning_modules (
      learning_module_id  UUID    NOT NULL,
      learning_path_id    UUID    NOT NULL,
      title               TEXT    NOT NULL,
      position            INTEGER NOT NULL,
      CONSTRAINT pk_learning_modules PRIMARY KEY (learning_module_id),
      CONSTRAINT fk_learning_modules_learning_path_id FOREIGN KEY (learning_path_id) REFERENCES learning_paths(learning_path_id) ON DELETE CASCADE,
      CONSTRAINT uq_learning_modules_learning_path_id_position UNIQUE (learning_path_id, position)
    )""")
    op.execute("""
    CREATE TABLE learning_tasks (
      learning_task_id    UUID         NOT NULL,
      learning_module_id  UUID         NOT NULL,
      title               TEXT         NOT NULL,
      description         TEXT         NOT NULL DEFAULT '',
      resource_url        TEXT         NULL,
      estimated_hours     NUMERIC(5,1) NULL,
      position            INTEGER      NOT NULL,
      CONSTRAINT pk_learning_tasks PRIMARY KEY (learning_task_id),
      CONSTRAINT fk_learning_tasks_learning_module_id FOREIGN KEY (learning_module_id) REFERENCES learning_modules(learning_module_id) ON DELETE CASCADE,
      CONSTRAINT uq_learning_tasks_learning_module_id_position UNIQUE (learning_module_id, position),
      CONSTRAINT ck_learning_tasks_resource_url CHECK (resource_url IS NULL OR resource_url ~ '^https?://')
    )""")
    op.execute("""
    CREATE TABLE learning_path_enrollments (
      user_id              UUID        NOT NULL,   -- one active learning path per researcher
      learning_path_id     UUID        NOT NULL,
      enrollment_version   INTEGER     NOT NULL DEFAULT 1,
      assigned_by_user_id  UUID        NULL,
      assigned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      target_date          DATE        NULL,
      completed_at         TIMESTAMPTZ NULL,
      CONSTRAINT pk_learning_path_enrollments PRIMARY KEY (user_id),
      CONSTRAINT fk_learning_path_enrollments_user_id FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_learning_path_enrollments_learning_path_id FOREIGN KEY (learning_path_id) REFERENCES learning_paths(learning_path_id) ON DELETE CASCADE,
      CONSTRAINT fk_learning_path_enrollments_assigned_by_user_id FOREIGN KEY (assigned_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
    )""")
    op.execute("""
    CREATE TABLE learning_task_completions (
      user_id           UUID        NOT NULL,
      learning_task_id  UUID        NOT NULL,
      completed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT pk_learning_task_completions PRIMARY KEY (user_id, learning_task_id),
      CONSTRAINT fk_learning_task_completions_user_id FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_learning_task_completions_learning_task_id FOREIGN KEY (learning_task_id) REFERENCES learning_tasks(learning_task_id) ON DELETE CASCADE
    )""")


def downgrade() -> None:
    for table in (
        "learning_task_completions",
        "learning_path_enrollments",
        "learning_tasks",
        "learning_modules",
        "learning_paths",
        "availability_blocks",
        "project_members",
    ):
        op.execute(f"DROP TABLE {table}")
    op.execute("DROP INDEX ix_tasks_project_id")
    op.execute("""
    ALTER TABLE tasks
      DROP COLUMN status, DROP COLUMN priority, DROP COLUMN source, DROP COLUMN github_issue_url,
      DROP COLUMN required_skills, DROP COLUMN is_archived, DROP COLUMN created_by_user_id,
      DROP COLUMN created_at, DROP COLUMN updated_at, DROP COLUMN completed_at,
      DROP CONSTRAINT ck_tasks_title_length, DROP CONSTRAINT ck_tasks_estimated_hours_non_negative
    """)
    op.execute("DROP INDEX uq_projects_name_lower")
    op.execute("""
    ALTER TABLE projects
      DROP COLUMN description, DROP COLUMN research_question, DROP COLUMN hypothesis,
      DROP COLUMN research_track, DROP COLUMN stage, DROP COLUMN project_manager_user_id,
      DROP COLUMN research_lead_user_id, DROP COLUMN start_date, DROP COLUMN target_date,
      DROP COLUMN github_repository, DROP COLUMN github_project_url, DROP COLUMN is_archived,
      DROP COLUMN created_by_user_id, DROP COLUMN created_at,
      DROP CONSTRAINT ck_projects_name_length
    """)
    op.execute("""
    ALTER TABLE users
      DROP COLUMN research_status, DROP COLUMN skills,
      DROP CONSTRAINT ck_users_display_name_length
    """)
