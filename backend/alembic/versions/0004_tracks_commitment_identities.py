"""Member tags (track + commitment), access approval and sign-in identities.

Revision ID: 0004

- research_status collapses to a two-value track tag: LEARNING_PATH | RESEARCH.
  RESEARCH_READY and FULL_TIME rows become RESEARCH.
- commitment: SHADOW (5 h/week) | FULL_TIME (10 h/week). Old FULL_TIME status maps to FULL_TIME.
- access_status: people who sign in with an unrecognised GitHub account are
  created PENDING and only see a waiting screen until a PM approves them.
- user_identities links a Firebase uid (and the GitHub account behind it) to a user.
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE users
      DROP CONSTRAINT ck_users_research_status,
      ADD COLUMN commitment    TEXT NOT NULL DEFAULT 'SHADOW',
      ADD COLUMN access_status TEXT NOT NULL DEFAULT 'APPROVED',
      ADD COLUMN avatar_url    TEXT NULL
    """)
    op.execute("UPDATE users SET commitment = 'FULL_TIME' WHERE research_status = 'FULL_TIME'")
    op.execute("UPDATE users SET research_status = 'RESEARCH' WHERE research_status IN ('RESEARCH_READY', 'FULL_TIME')")
    op.execute("""
    ALTER TABLE users
      ADD CONSTRAINT ck_users_research_status CHECK (research_status IN ('LEARNING_PATH', 'RESEARCH')),
      ADD CONSTRAINT ck_users_commitment      CHECK (commitment IN ('SHADOW', 'FULL_TIME')),
      ADD CONSTRAINT ck_users_access_status   CHECK (access_status IN ('PENDING', 'APPROVED')),
      ADD CONSTRAINT ck_users_avatar_url      CHECK (avatar_url IS NULL OR avatar_url LIKE 'https://%')
    """)
    op.execute("""
    CREATE TABLE user_identities (
      user_identity_id BIGINT GENERATED ALWAYS AS IDENTITY,
      user_id          UUID        NOT NULL,
      firebase_uid     TEXT        NOT NULL,
      github_user_id   BIGINT      NULL,
      github_login     TEXT        NULL,
      email            TEXT        NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_sign_in_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT pk_user_identities PRIMARY KEY (user_identity_id),
      CONSTRAINT fk_user_identities_user_id FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      CONSTRAINT uq_user_identities_firebase_uid UNIQUE (firebase_uid),
      CONSTRAINT uq_user_identities_github_user_id UNIQUE (github_user_id)
    )
    """)
    op.execute("CREATE INDEX ix_user_identities_user_id ON user_identities (user_id)")
    op.execute("CREATE INDEX ix_users_access_pending ON users (created_at) WHERE access_status = 'PENDING'")


def downgrade() -> None:
    op.execute("DROP TABLE user_identities")
    op.execute("DROP INDEX ix_users_access_pending")
    op.execute("""
    ALTER TABLE users
      DROP CONSTRAINT ck_users_research_status, DROP CONSTRAINT ck_users_commitment,
      DROP CONSTRAINT ck_users_access_status, DROP CONSTRAINT ck_users_avatar_url
    """)
    op.execute("UPDATE users SET research_status = 'FULL_TIME' WHERE research_status = 'RESEARCH'")
    op.execute("""
    ALTER TABLE users
      DROP COLUMN commitment, DROP COLUMN access_status, DROP COLUMN avatar_url,
      ADD CONSTRAINT ck_users_research_status CHECK (research_status IN ('LEARNING_PATH', 'RESEARCH_READY', 'FULL_TIME'))
    """)
