import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.users.domain import AccessStatus, Commitment, ResearchStatus, Role
from app.users.workload import CapacityState, Workload

DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Skill = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class UserRef(BaseModel):
    """The minimum the UI needs to show a person: never make anyone type a UUID."""

    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    display_name: str


class UserListItem(UserRef):
    role: Role
    research_status: ResearchStatus
    commitment: Commitment


class MeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    display_name: str
    email: str
    role: Role
    research_status: ResearchStatus
    commitment: Commitment
    committed_hours: float
    access_status: AccessStatus
    avatar_url: str | None = None
    skills: list[str]
    is_manager: bool


class MeUpdate(BaseModel):
    display_name: DisplayName | None = None
    skills: list[Skill] | None = Field(default=None, max_length=30)


class UserCreate(BaseModel):
    display_name: DisplayName
    email: EmailStr
    role: Role = Role.RESEARCHER
    research_status: ResearchStatus = ResearchStatus.LEARNING_PATH
    commitment: Commitment = Commitment.SHADOW
    skills: list[Skill] = Field(default_factory=list, max_length=30)


class WorkloadOut(BaseModel):
    capacity_hours: float
    assigned_hours: float
    open_task_count: int
    capacity_state: CapacityState
    committed_hours: float = 0.0
    below_commitment: bool = False

    @classmethod
    def of(cls, w: Workload) -> "WorkloadOut":
        return cls(
            capacity_hours=w.capacity_hours,
            assigned_hours=w.assigned_hours,
            open_task_count=w.open_task_count,
            capacity_state=w.state,
            committed_hours=w.committed_hours,
            below_commitment=w.below_commitment,
        )


class ProjectRef(BaseModel):
    project_id: uuid.UUID
    name: str


class LearningProgressRef(BaseModel):
    learning_path_id: uuid.UUID
    name: str
    progress_percent: int
    completed_task_count: int
    total_task_count: int


class ResearcherSummaryOut(BaseModel):
    user_id: uuid.UUID
    display_name: str
    email: str
    role: Role
    research_status: ResearchStatus
    commitment: Commitment
    skills: list[str]
    workload: WorkloadOut
    projects: list[ProjectRef]
    learning: LearningProgressRef | None


class ResearcherUpdate(BaseModel):
    display_name: DisplayName | None = None
    research_status: ResearchStatus | None = None
    commitment: Commitment | None = None
    skills: list[Skill] | None = Field(default=None, max_length=30)
