from pydantic import BaseModel

from app.availability.schemas import AvailabilityOut
from app.learning.schemas import LearningProgressOut
from app.research.schemas import ProjectSummaryOut, TaskOut
from app.users.schemas import ResearcherSummaryOut


class ResearcherDetailOut(BaseModel):
    researcher: ResearcherSummaryOut
    availability: AvailabilityOut
    open_tasks: list[TaskOut]
    recently_completed_tasks: list[TaskOut]
    projects: list[ProjectSummaryOut]
    learning: LearningProgressOut | None
    viewer_can_manage: bool
