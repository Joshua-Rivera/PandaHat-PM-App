import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, StringConstraints, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import ManagerUser
from app.db import SessionLocal, get_db
from app.errors import InvalidInputError
from app.notifications.domain.events import PmAnnouncementEvent
from app.notifications.services.emit import emit_notification_event
from app.research.models import Project, ProjectMember
from app.users.models import User

router = APIRouter(prefix="/api/v1/announcements", tags=["announcements"])

Db = Annotated[Session, Depends(get_db)]


class AnnouncementCreateRequest(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    audience: Literal["ALL", "PROJECT"] = "ALL"
    project_id: uuid.UUID | None = None
    is_urgent: bool = False

    @model_validator(mode="after")
    def _project_required(self) -> "AnnouncementCreateRequest":
        if (self.audience == "PROJECT") != (self.project_id is not None):
            raise ValueError("Choose a project when the audience is a single project")
        return self


class AnnouncementCreatedOut(BaseModel):
    recipient_count: int


@router.post("", operation_id="createAnnouncement", response_model=AnnouncementCreatedOut, status_code=status.HTTP_201_CREATED)
def create_announcement(body: AnnouncementCreateRequest, actor: ManagerUser, db: Db) -> AnnouncementCreatedOut:
    if body.audience == "PROJECT":
        if db.get(Project, body.project_id) is None:
            raise InvalidInputError("Choose a project", field="project_id")
        audience = list(
            db.scalars(
                select(ProjectMember.user_id).where(
                    ProjectMember.project_id == body.project_id, ProjectMember.removed_at.is_(None)
                )
            )
        )
    else:
        audience = list(db.scalars(select(User.user_id).where(User.is_active.is_(True), User.access_status == "APPROVED")))
    created = emit_notification_event(
        PmAnnouncementEvent(
            actor_user_id=actor.user_id,
            announcement_id=uuid.uuid4(),
            title=body.title,
            message=body.message,
            is_urgent=body.is_urgent,
            audience_user_ids=audience,
        ),
        SessionLocal,
    )
    return AnnouncementCreatedOut(recipient_count=len(created))
