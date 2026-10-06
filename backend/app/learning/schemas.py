import uuid
from datetime import date, datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.users.schemas import UserRef

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ResourceUrl = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^https?://\S+$", max_length=500)]


class LearningTaskIn(BaseModel):
    title: Title
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    resource_url: ResourceUrl | None = None
    estimated_hours: float | None = Field(default=None, ge=0, le=999)


class LearningModuleIn(BaseModel):
    title: Title
    tasks: list[LearningTaskIn] = Field(min_length=1, max_length=50)


class LearningPathCreate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    modules: list[LearningModuleIn] = Field(min_length=1, max_length=30)


class ModuleState(StrEnum):
    COMPLETED = "COMPLETED"
    IN_PROGRESS = "IN_PROGRESS"
    NOT_STARTED = "NOT_STARTED"


class LearningTaskOut(BaseModel):
    learning_task_id: uuid.UUID
    title: str
    description: str
    resource_url: str | None
    estimated_hours: float | None
    is_completed: bool
    completed_at: datetime | None


class LearningModuleOut(BaseModel):
    learning_module_id: uuid.UUID
    title: str
    position: int
    tasks: list[LearningTaskOut]
    completed_task_count: int
    total_task_count: int
    state: ModuleState


class CurrentLearningTaskOut(LearningTaskOut):
    module_title: str


class LearningProgressOut(BaseModel):
    """A learning path as one researcher sees it: structure plus their progress."""

    learning_path_id: uuid.UUID
    name: str
    description: str
    modules: list[LearningModuleOut]
    completed_task_count: int
    total_task_count: int
    progress_percent: int
    current_task: CurrentLearningTaskOut | None
    target_date: date | None
    assigned_at: datetime
    completed_at: datetime | None


class MyLearningPathOut(BaseModel):
    enrollment: LearningProgressOut | None  # None = no path assigned yet


class LearningTaskCompletionRequest(BaseModel):
    is_completed: bool


class LearningPathListItem(BaseModel):
    learning_path_id: uuid.UUID
    name: str
    description: str
    module_count: int
    task_count: int
    enrolled_count: int


class LearningEnrollmentOut(BaseModel):
    researcher: UserRef
    progress_percent: int
    completed_at: datetime | None
    target_date: date | None


class LearningPathDetailOut(BaseModel):
    learning_path_id: uuid.UUID
    name: str
    description: str
    modules: list[LearningModuleOut]
    total_task_count: int
    enrollments: list[LearningEnrollmentOut]


class AssignLearningPathRequest(BaseModel):
    learning_path_id: uuid.UUID
    target_date: date | None = None
