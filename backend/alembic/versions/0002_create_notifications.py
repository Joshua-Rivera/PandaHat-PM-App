"""Create the notifications table (in-app notifications).

Revision ID: 0002

YOUR TASK (Phase 1, step 1)
---------------------------
Write the DDL for `notifications` following design report §4. This migration
is the source of truth for the table; app/notifications/persistence/models.py
only *describes* it for queries.

Verify with:   .venv/bin/pytest tests/notifications/test_migration.py

Checklist, each item is asserted by a test:
  [ ] PK named pk_notifications on notification_id (BIGINT GENERATED ALWAYS AS IDENTITY)
  [ ] Columns: recipient_user_id, actor_user_id, event_type, priority, title, body,
      resource_type, resource_id, action_path, dedupe_key, created_at, read_at
      (copy names/types/nullability from §4; leave out announcement_id, which
      arrives with the announcements table in a later phase)
  [ ] fk_notifications_recipient_user_id → users, ON DELETE CASCADE
  [ ] fk_notifications_actor_user_id     → users, ON DELETE SET NULL
  [ ] uq_notifications_recipient_dedupe  UNIQUE (recipient_user_id, dedupe_key)
  [ ] ck_notifications_priority          use PRIORITIES_SQL below
  [ ] ck_notifications_event_type        use EVENT_TYPES_SQL below
  [ ] ck_notifications_resource_pair     resource_type and resource_id are both NULL or both set
  [ ] ck_notifications_action_path_relative  starts with '/' but NOT with '//'
  [ ] ck_notifications_title_length (≤200), ck_notifications_body_length (≤2000)
  [ ] ix_notifications_recipient_feed    (recipient_user_id, created_at DESC, notification_id DESC)
  [ ] ix_notifications_recipient_unread  on (recipient_user_id) — PARTIAL: WHERE read_at IS NULL
  [ ] downgrade() drops the table

Questions to answer for yourself (we'll discuss them in review):
  * Why does the feed index include notification_id, not just created_at?
  * Why is the unread index partial, and what would a full index on read_at cost?
  * Why does '//evil.example' need its own rule when it already starts with '/'?
"""
from alembic import op

from app.notifications.domain.event_types import EventType, Priority

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# Generated from the Python enums so the DB and code can never disagree.
EVENT_TYPES_SQL = ", ".join(f"'{e.value}'" for e in EventType)
PRIORITIES_SQL = ", ".join(f"'{p.value}'" for p in Priority)


def upgrade() -> None:
    op.execute(f"""
    CREATE TABLE notifications (
      notification_id    BIGINT      GENERATED ALWAYS AS IDENTITY,
      recipient_user_id  UUID        NOT NULL,
      actor_user_id      UUID        NULL,
      event_type         TEXT        NOT NULL,
      priority           TEXT        NOT NULL,
      title              TEXT        NOT NULL,
      body               TEXT        NOT NULL,
      resource_type      TEXT        NULL,
      resource_id        TEXT        NULL,
      action_path        TEXT        NULL,
      dedupe_key         TEXT        NOT NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      read_at            TIMESTAMPTZ NULL,
      CONSTRAINT pk_notifications PRIMARY KEY (notification_id),
      CONSTRAINT fk_notifications_recipient_user_id FOREIGN KEY (recipient_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_notifications_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
      CONSTRAINT uq_notifications_recipient_dedupe UNIQUE (recipient_user_id, dedupe_key),
      CONSTRAINT ck_notifications_priority CHECK (priority IN ({PRIORITIES_SQL})),
      CONSTRAINT ck_notifications_event_type CHECK (event_type IN ({EVENT_TYPES_SQL})),
      CONSTRAINT ck_notifications_resource_pair CHECK ((resource_type IS NULL) = (resource_id IS NULL)),
      CONSTRAINT ck_notifications_action_path_relative CHECK (action_path LIKE '/%' AND action_path NOT LIKE '//%'),
      CONSTRAINT ck_notifications_title_length CHECK (char_length(title) <= 200),
      CONSTRAINT ck_notifications_body_length CHECK (char_length(body) <= 2000)
    )""")
    op.execute(
        "CREATE INDEX ix_notifications_recipient_feed "
        "ON notifications (recipient_user_id, created_at DESC, notification_id DESC)"
    )
    op.execute(
        "CREATE INDEX ix_notifications_recipient_unread "
        "ON notifications (recipient_user_id) WHERE read_at IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP TABLE notifications")
