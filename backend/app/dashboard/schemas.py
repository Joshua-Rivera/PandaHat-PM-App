from datetime import date, datetime

from pydantic import BaseModel

from app.research.schemas import ActivityItemOut, ProjectSummaryOut, TaskOut
from app.users.domain import ResearchStatus
from app.users.schemas import LearningProgressRef, ResearcherSummaryOut, UserRef, WorkloadOut


class UpcomingItemOut(BaseModel):
    due: datetime | date
    label: str
    kind: str  # task_deadline | project_target | learning_target
    link: str | None


class MyDashboardOut(BaseModel):
    """Researcher home: 'What am I supposed to work on?'"""

    display_name: str
    research_status: ResearchStatus
    workload: WorkloadOut
    tasks_due_this_week: int
    overdue_task_count: int
    current_project: ProjectSummaryOut | None
    open_tasks: list[TaskOut]
    recently_completed_tasks: list[TaskOut]
    upcoming: list[UpcomingItemOut]
    learning: LearningProgressRef | None


class NeedsAttentionOut(BaseModel):
    overloaded_researchers: list[UserRef]
    researchers_without_availability: list[UserRef]
    overdue_tasks: list[TaskOut]
    blocked_tasks: list[TaskOut]
    unassigned_open_task_count: int


class TeamOverviewOut(BaseModel):
    """PM home: 'How is the research group doing?'"""

    researcher_count: int
    learning_path_count: int
    research_count: int
    shadow_count: int
    full_time_count: int
    committed_hours_total: float
    capacity_hours_total: float
    assigned_hours_total: float
    team: list[ResearcherSummaryOut]
    projects: list[ProjectSummaryOut]
    needs_attention: NeedsAttentionOut
    recent_activity: list[ActivityItemOut]
