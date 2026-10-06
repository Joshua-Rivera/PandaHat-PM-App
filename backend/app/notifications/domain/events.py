"""Typed notification events.

An event is a plain, immutable description of something that happened. It is
NOT stored. The notification service turns it into persisted `notifications`
rows, one per recipient.

Each event knows three things about itself:
  * who should hear about it        -> recipient_user_ids()
  * how it reads in the inbox       -> render_in_app()
  * what makes it "the same event"  -> dedupe_key(recipient)

Events that target an audience (announcements to a whole project) will get a
recipient resolver that queries the DB; simple events carry their recipient.
"""

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import ClassVar

from pydantic import BaseModel, ConfigDict

from app.notifications.domain.event_types import EventType, Priority, ResourceType


@dataclass(frozen=True)
class InAppContent:
    title: str
    body: str
    resource_type: ResourceType | None = None
    resource_id: str | None = None
    action_path: str | None = None  # relative in-app path, e.g. /projects/<id>/tasks/<id>


class NotificationEvent(BaseModel, ABC):
    model_config = ConfigDict(frozen=True)

    event_type: ClassVar[EventType]
    actor_user_id: uuid.UUID | None = None  # who caused it; None = system/GitHub

    @abstractmethod
    def recipient_user_ids(self) -> list[uuid.UUID]: ...

    @abstractmethod
    def render_in_app(self) -> InAppContent: ...

    @abstractmethod
    def dedupe_key(self, recipient_user_id: uuid.UUID) -> str:
        """Deterministic key: emitting the same logical event twice yields the same key."""

    def priority_override(self) -> Priority | None:
        """None = use EVENT_REGISTRY. Only PM announcements choose their own priority."""
        return None


def _task_path(project_id: uuid.UUID, task_id: uuid.UUID) -> str:
    return f"/projects/{project_id}/tasks/{task_id}"


class TaskAssignedEvent(NotificationEvent):
    event_type: ClassVar[EventType] = EventType.TASK_ASSIGNED

    task_id: uuid.UUID
    task_title: str
    project_id: uuid.UUID
    project_name: str
    assignee_user_id: uuid.UUID
    assignment_version: int
    deadline_at: datetime | None = None

    def recipient_user_ids(self) -> list[uuid.UUID]:
        # Don't notify people about tasks they assigned to themselves.
        if self.actor_user_id == self.assignee_user_id:
            return []
        return [self.assignee_user_id]

    def render_in_app(self) -> InAppContent:
        body = self.project_name
        if self.deadline_at:
            # Due dates are calendar dates stored at 23:59 UTC: format in UTC so
            # the day matches what every browser shows.
            body += f" · due {self.deadline_at.astimezone(UTC):%a %d %b}"
        return InAppContent(
            title=f"New task: {self.task_title}",
            body=body,
            resource_type=ResourceType.TASK,
            resource_id=str(self.task_id),
            action_path=_task_path(self.project_id, self.task_id),
        )

    def dedupe_key(self, recipient_user_id: uuid.UUID) -> str:
        return f"{self.event_type}:task={self.task_id}:assignee={recipient_user_id}:v={self.assignment_version}"


class TaskUnassignedEvent(NotificationEvent):
    event_type: ClassVar[EventType] = EventType.TASK_UNASSIGNED

    task_id: uuid.UUID
    task_title: str
    project_id: uuid.UUID
    project_name: str
    previous_assignee_user_id: uuid.UUID
    assignment_version: int

    def recipient_user_ids(self) -> list[uuid.UUID]:
        if self.actor_user_id == self.previous_assignee_user_id:
            return []
        return [self.previous_assignee_user_id]

    def render_in_app(self) -> InAppContent:
        return InAppContent(
            title=f"Removed from task: {self.task_title}",
            body=self.project_name,
            resource_type=ResourceType.TASK,
            resource_id=str(self.task_id),
            action_path=_task_path(self.project_id, self.task_id),
        )

    def dedupe_key(self, recipient_user_id: uuid.UUID) -> str:
        return f"{self.event_type}:task={self.task_id}:assignee={recipient_user_id}:v={self.assignment_version}"


class DeadlineChangedEvent(NotificationEvent):
    event_type: ClassVar[EventType] = EventType.DEADLINE_CHANGED

    task_id: uuid.UUID
    task_title: str
    project_id: uuid.UUID
    assignee_user_id: uuid.UUID
    deadline_at: datetime | None

    def recipient_user_ids(self) -> list[uuid.UUID]:
        if self.actor_user_id == self.assignee_user_id:
            return []
        return [self.assignee_user_id]

    def render_in_app(self) -> InAppContent:
        body = (
            f"New deadline: {self.deadline_at.astimezone(UTC):%a %d %b}" if self.deadline_at else "The deadline was removed"
        )
        return InAppContent(
            title=f"Deadline changed: {self.task_title}",
            body=body,
            resource_type=ResourceType.TASK,
            resource_id=str(self.task_id),
            action_path=_task_path(self.project_id, self.task_id),
        )

    def dedupe_key(self, recipient_user_id: uuid.UUID) -> str:
        # The new deadline is part of the key: changing it twice to different
        # dates is two events; saving the same date twice is one.
        deadline = self.deadline_at.isoformat() if self.deadline_at else "none"
        return f"{self.event_type}:task={self.task_id}:assignee={recipient_user_id}:deadline={deadline}"


class ProjectMembershipEvent(NotificationEvent):
    """Base for PROJECT_ASSIGNED / PROJECT_REMOVED. membership_version makes
    add → remove → add again produce fresh notifications."""

    project_id: uuid.UUID
    project_name: str
    member_user_id: uuid.UUID
    membership_version: int

    def recipient_user_ids(self) -> list[uuid.UUID]:
        if self.actor_user_id == self.member_user_id:
            return []
        return [self.member_user_id]

    def dedupe_key(self, recipient_user_id: uuid.UUID) -> str:
        return f"{self.event_type}:project={self.project_id}:member={recipient_user_id}:v={self.membership_version}"


class ProjectAssignedEvent(ProjectMembershipEvent):
    event_type: ClassVar[EventType] = EventType.PROJECT_ASSIGNED

    def render_in_app(self) -> InAppContent:
        return InAppContent(
            title=f"Added to project: {self.project_name}",
            body="You are now a researcher on this project.",
            resource_type=ResourceType.PROJECT,
            resource_id=str(self.project_id),
            action_path=f"/projects/{self.project_id}",
        )


class ProjectRemovedEvent(ProjectMembershipEvent):
    event_type: ClassVar[EventType] = EventType.PROJECT_REMOVED

    def render_in_app(self) -> InAppContent:
        return InAppContent(
            title=f"Removed from project: {self.project_name}",
            body="You are no longer a member of this project.",
            resource_type=ResourceType.PROJECT,
            resource_id=str(self.project_id),
            action_path="/projects",
        )


class LearningPathAssignedEvent(NotificationEvent):
    """Uses LEARNING_TASK_ASSIGNED: assigning a path assigns its first task."""

    event_type: ClassVar[EventType] = EventType.LEARNING_TASK_ASSIGNED

    learning_path_id: uuid.UUID
    learning_path_name: str
    first_task_title: str | None
    researcher_user_id: uuid.UUID
    enrollment_version: int

    def recipient_user_ids(self) -> list[uuid.UUID]:
        return [self.researcher_user_id]

    def render_in_app(self) -> InAppContent:
        body = f"Start with: {self.first_task_title}" if self.first_task_title else "Open your learning path to begin."
        return InAppContent(
            title=f"Learning path assigned: {self.learning_path_name}",
            body=body,
            resource_type=ResourceType.LEARNING_TASK,
            resource_id=str(self.learning_path_id),
            action_path="/learning",
        )

    def dedupe_key(self, recipient_user_id: uuid.UUID) -> str:
        return f"{self.event_type}:path={self.learning_path_id}:user={recipient_user_id}:v={self.enrollment_version}"


class LearningPathCompletedEvent(NotificationEvent):
    """Sent to PMs/admins so they can move the researcher to the Research track."""

    event_type: ClassVar[EventType] = EventType.LEARNING_PATH_COMPLETED

    learning_path_id: uuid.UUID
    learning_path_name: str
    researcher_user_id: uuid.UUID
    researcher_name: str
    manager_user_ids: list[uuid.UUID]
    enrollment_version: int

    def recipient_user_ids(self) -> list[uuid.UUID]:
        return list(self.manager_user_ids)

    def render_in_app(self) -> InAppContent:
        return InAppContent(
            title=f"{self.researcher_name} completed {self.learning_path_name}",
            body="Review their progress and move them to the Research track.",
            resource_type=ResourceType.LEARNING_TASK,
            resource_id=str(self.learning_path_id),
            action_path=f"/team/{self.researcher_user_id}",
        )

    def dedupe_key(self, recipient_user_id: uuid.UUID) -> str:
        return (
            f"{self.event_type}:path={self.learning_path_id}:researcher={self.researcher_user_id}"
            f":to={recipient_user_id}:v={self.enrollment_version}"
        )


class ResearchReadyEvent(NotificationEvent):
    event_type: ClassVar[EventType] = EventType.RESEARCH_READY

    researcher_user_id: uuid.UUID

    def recipient_user_ids(self) -> list[uuid.UUID]:
        return [self.researcher_user_id]

    def render_in_app(self) -> InAppContent:
        return InAppContent(
            title="You're on the Research track",
            body="You've finished onboarding and can now be assigned to full research projects.",
            action_path="/",
        )

    def dedupe_key(self, recipient_user_id: uuid.UUID) -> str:
        # Once per researcher: toggling the status back and forth shouldn't spam them.
        return f"{self.event_type}:user={recipient_user_id}"


class PmAnnouncementEvent(NotificationEvent):
    event_type: ClassVar[EventType] = EventType.PM_ANNOUNCEMENT

    announcement_id: uuid.UUID
    title: str
    message: str
    is_urgent: bool = False
    audience_user_ids: list[uuid.UUID]

    def recipient_user_ids(self) -> list[uuid.UUID]:
        return [u for u in self.audience_user_ids if u != self.actor_user_id]

    def render_in_app(self) -> InAppContent:
        return InAppContent(title=self.title, body=self.message)

    def dedupe_key(self, recipient_user_id: uuid.UUID) -> str:
        return f"{self.event_type}:announcement={self.announcement_id}"

    def priority_override(self) -> Priority | None:
        return Priority.URGENT if self.is_urgent else None
