import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.research.domain import ProjectStage, TaskPriority, TaskSource, TaskStatus
from app.users.domain import Commitment, ResearchStatus
from app.users.schemas import Skill, UserRef

ProjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
TaskTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]
GithubRepository = Annotated[
    str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", max_length=200)
]
GithubUrl = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^https://github\.com/\S+$", max_length=500)]
Hours = Annotated[float, Field(ge=0, le=999)]


# ── Projects ────────────────────────────────────────────────────────────────


class _ProjectFields(BaseModel):
    description: LongText = ""
    research_question: LongText = ""
    hypothesis: LongText = ""
    research_track: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""
    stage: ProjectStage = ProjectStage.PLANNING
    project_manager_user_id: uuid.UUID | None = None
    research_lead_user_id: uuid.UUID | None = None
    start_date: date | None = None
    target_date: date | None = None
    github_repository: GithubRepository | None = None
    github_project_url: GithubUrl | None = None


class ProjectCreate(_ProjectFields):
    name: ProjectName

    @model_validator(mode="after")
    def _dates_ordered(self) -> "ProjectCreate":
        if self.start_date and self.target_date and self.target_date < self.start_date:
            raise ValueError("Target date must be on or after the start date")
        return self


class ProjectUpdate(BaseModel):
    """PATCH: only fields present in the request body are changed (model_fields_set)."""

    name: ProjectName | None = None
    description: LongText | None = None
    research_question: LongText | None = None
    hypothesis: LongText | None = None
    research_track: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None
    stage: ProjectStage | None = None
    project_manager_user_id: uuid.UUID | None = None
    research_lead_user_id: uuid.UUID | None = None
    start_date: date | None = None
    target_date: date | None = None
    github_repository: GithubRepository | None = None
    github_project_url: GithubUrl | None = None
    is_archived: bool | None = None


class ProjectStats(BaseModel):
    member_count: int = 0
    open_task_count: int = 0
    completed_task_count: int = 0
    blocked_task_count: int = 0
    overdue_task_count: int = 0
    progress_percent: int = 0
    next_deadline_at: datetime | None = None


class ProjectSummaryOut(BaseModel):
    project_id: uuid.UUID
    name: str
    description: str
    research_track: str
    stage: ProjectStage
    target_date: date | None
    is_archived: bool
    project_manager: UserRef | None
    stats: ProjectStats


class ProjectMemberOut(BaseModel):
    user_id: uuid.UUID
    display_name: str
    research_status: ResearchStatus
    commitment: Commitment
    open_task_count: int
    added_at: datetime


class ProjectDetailOut(ProjectSummaryOut):
    research_question: str
    hypothesis: str
    research_lead: UserRef | None
    start_date: date | None
    github_repository: str | None
    github_project_url: str | None
    created_at: datetime
    members: list[ProjectMemberOut]
    viewer_can_manage: bool


class AddProjectMemberRequest(BaseModel):
    user_id: uuid.UUID


# ── Tasks ───────────────────────────────────────────────────────────────────


class TaskCreate(BaseModel):
    title: TaskTitle
    description: LongText = ""
    project_id: uuid.UUID
    assignee_user_id: uuid.UUID | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    estimated_hours: Hours | None = None
    deadline_at: datetime | None = None
    required_skills: list[Skill] = Field(default_factory=list, max_length=20)
    github_issue_url: GithubUrl | None = None


class TaskUpdate(BaseModel):
    """PATCH. Managers may send any field; the assignee may only send `status`.
    The service enforces that, not the client."""

    title: TaskTitle | None = None
    description: LongText | None = None
    project_id: uuid.UUID | None = None
    assignee_user_id: uuid.UUID | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    estimated_hours: Hours | None = None
    deadline_at: datetime | None = None
    required_skills: list[Skill] | None = Field(default=None, max_length=20)
    github_issue_url: GithubUrl | None = None


class AssignTaskRequest(BaseModel):
    assignee_user_id: uuid.UUID | None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    title: str
    description: str
    status: TaskStatus
    priority: TaskPriority
    source: TaskSource
    github_issue_url: str | None
    estimated_hours: float | None
    deadline_at: datetime | None
    required_skills: list[str]
    assignee: UserRef | None
    assignee_user_id: uuid.UUID | None
    assignment_version: int
    is_archived: bool
    is_overdue: bool
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    viewer_can_manage: bool
    viewer_can_update_status: bool


class ActivityItemOut(BaseModel):
    occurred_at: datetime
    kind: str  # task_created | task_completed | project_created
    text: str
    link: str | None
