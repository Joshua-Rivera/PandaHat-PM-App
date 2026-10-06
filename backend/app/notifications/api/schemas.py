import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notification_id: int
    event_type: str
    priority: str
    title: str
    body: str
    resource_type: str | None
    resource_id: str | None
    action_path: str | None
    actor_user_id: uuid.UUID | None
    created_at: datetime
    read_at: datetime | None

    @computed_field
    @property
    def is_read(self) -> bool:
        return self.read_at is not None


class NotificationPageOut(BaseModel):
    items: list[NotificationOut]
    next_cursor: str | None


class UnreadCountOut(BaseModel):
    unread_count: int


class MarkReadRequest(BaseModel):
    is_read: bool


class MarkAllReadRequest(BaseModel):
    # The client sends the timestamp of the newest notification it has seen, so
    # a notification that arrives mid-click is not silently marked read.
    read_before: datetime = Field(description="Mark unread notifications created at or before this time")


class MarkAllReadOut(BaseModel):
    updated_count: int
