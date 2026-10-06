"""Default behaviour for every event type (design report §3).

Defaults are product decisions, so they live in code review rather than in the
database. Users can only override channels that are not mandatory (Phase 4).
"""

from dataclasses import dataclass

from app.notifications.domain.event_types import Channel, EventType, Priority

IN_APP = Channel.IN_APP
EMAIL = Channel.EMAIL


@dataclass(frozen=True)
class EventSpec:
    priority: Priority
    default_channels: frozenset[Channel]
    # Channels the user cannot turn off. Always a subset of default_channels.
    mandatory_channels: frozenset[Channel] = frozenset()
    email_template_id: str | None = None
    # LOW-signal events that the weekly digest summarises instead of emailing.
    is_digestible: bool = False


def _spec(priority, channels, mandatory=(), template=None, digestible=False) -> EventSpec:
    return EventSpec(priority, frozenset(channels), frozenset(mandatory), template, digestible)


EVENT_REGISTRY: dict[EventType, EventSpec] = {
    EventType.TASK_ASSIGNED: _spec(Priority.NORMAL, {IN_APP, EMAIL}, {IN_APP}, "task_assigned"),
    EventType.TASK_UNASSIGNED: _spec(Priority.NORMAL, {IN_APP}),
    EventType.DEADLINE_APPROACHING: _spec(Priority.HIGH, {IN_APP, EMAIL}, {IN_APP}, "deadline_reminder"),
    EventType.DEADLINE_CHANGED: _spec(Priority.NORMAL, {IN_APP, EMAIL}, {IN_APP}, "deadline_changed"),
    EventType.LEARNING_TASK_ASSIGNED: _spec(Priority.NORMAL, {IN_APP, EMAIL}, template="learning_task_assigned"),
    EventType.LEARNING_MODULE_COMPLETED: _spec(Priority.LOW, {IN_APP}, digestible=True),
    EventType.LEARNING_PATH_COMPLETED: _spec(Priority.NORMAL, {IN_APP, EMAIL}, template="learning_path_completed"),
    EventType.RESEARCH_READY: _spec(Priority.HIGH, {IN_APP, EMAIL}, {IN_APP}, "research_ready"),
    EventType.PROJECT_ASSIGNED: _spec(Priority.NORMAL, {IN_APP, EMAIL}, {IN_APP}, "project_assigned"),
    EventType.PROJECT_REMOVED: _spec(Priority.NORMAL, {IN_APP, EMAIL}, {IN_APP}, "project_removed"),
    EventType.EXPERIMENT_ASSIGNED: _spec(Priority.NORMAL, {IN_APP, EMAIL}, template="experiment_assigned"),
    EventType.EXPERIMENT_STATUS_CHANGED: _spec(Priority.LOW, {IN_APP}, digestible=True),
    EventType.RESEARCH_MILESTONE_REACHED: _spec(Priority.NORMAL, {IN_APP}, digestible=True),
    # Priority is chosen by the PM per announcement (NORMAL/URGENT); this is the default.
    EventType.PM_ANNOUNCEMENT: _spec(Priority.NORMAL, {IN_APP, EMAIL}, {IN_APP}, "announcement"),
    EventType.WEEKLY_RESEARCH_SUMMARY: _spec(Priority.LOW, {EMAIL}, template="weekly_summary"),
    EventType.GITHUB_ISSUE_ASSIGNED: _spec(Priority.NORMAL, {IN_APP}),
    EventType.GITHUB_ISSUE_CLOSED: _spec(Priority.LOW, {IN_APP}, digestible=True),
    EventType.GITHUB_PR_OPENED: _spec(Priority.LOW, {IN_APP}, digestible=True),
    EventType.GITHUB_PR_MERGED: _spec(Priority.LOW, {IN_APP}, digestible=True),
    EventType.GITHUB_MILESTONE_CHANGED: _spec(Priority.LOW, {IN_APP}, digestible=True),
}
