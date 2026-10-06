from enum import StrEnum


class TaskStatus(StrEnum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    COMPLETED = "COMPLETED"


OPEN_TASK_STATUSES = (TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED)


class TaskPriority(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class TaskSource(StrEnum):
    """LOCAL tasks live only in PandaHat. GITHUB_LINKED tasks point at a GitHub
    issue, which becomes the source of truth once sync lands (Notification Phase 3)."""

    LOCAL = "LOCAL"
    GITHUB_LINKED = "GITHUB_LINKED"


class ProjectStage(StrEnum):
    PLANNING = "PLANNING"
    LITERATURE_REVIEW = "LITERATURE_REVIEW"
    EXPERIMENT_DESIGN = "EXPERIMENT_DESIGN"
    EXPERIMENT_VALIDATION = "EXPERIMENT_VALIDATION"
    ANALYSIS = "ANALYSIS"
    WRITING = "WRITING"
    COMPLETE = "COMPLETE"
