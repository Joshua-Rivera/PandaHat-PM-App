"""Pure unit tests — no database. These pass from day one and document the rules."""

import uuid

from app.notifications.domain.event_registry import EVENT_REGISTRY
from app.notifications.domain.event_types import Channel, EventType, Priority
from tests.notifications.factories import task_assigned_event


def test_every_event_type_has_a_spec():
    assert set(EVENT_REGISTRY) == set(EventType)


def test_mandatory_channels_are_always_default_channels():
    for event_type, spec in EVENT_REGISTRY.items():
        assert spec.mandatory_channels <= spec.default_channels, event_type


def test_low_priority_events_never_email_immediately():
    for event_type, spec in EVENT_REGISTRY.items():
        if spec.priority is Priority.LOW and event_type is not EventType.WEEKLY_RESEARCH_SUMMARY:
            assert Channel.EMAIL not in spec.default_channels, event_type


def test_urgent_is_not_a_default_priority():
    assert all(spec.priority is not Priority.URGENT for spec in EVENT_REGISTRY.values())


def test_email_channel_requires_a_template():
    for event_type, spec in EVENT_REGISTRY.items():
        if Channel.EMAIL in spec.default_channels:
            assert spec.email_template_id, event_type


def test_dedupe_key_is_deterministic_and_version_sensitive():
    assignee = uuid.uuid4()
    assert task_assigned_event(assignee).dedupe_key(assignee) == task_assigned_event(assignee).dedupe_key(assignee)
    assert task_assigned_event(assignee, version=1).dedupe_key(assignee) != task_assigned_event(
        assignee, version=2
    ).dedupe_key(assignee)


def test_self_assignment_has_no_recipients():
    me = uuid.uuid4()
    assert task_assigned_event(me, actor_user_id=me).recipient_user_ids() == []
