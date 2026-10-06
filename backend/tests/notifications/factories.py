import uuid

from app.notifications.domain.events import TaskAssignedEvent


def task_assigned_event(assignee_user_id: uuid.UUID, *, version: int = 1, actor_user_id=None, task_id=None):
    return TaskAssignedEvent(
        actor_user_id=actor_user_id,
        task_id=task_id or uuid.UUID(int=917),
        task_title="Evaluate TrustMark after JPEG compression",
        project_id=uuid.UUID(int=42),
        project_name="Watermark Robustness",
        assignee_user_id=assignee_user_id,
        assignment_version=version,
    )
