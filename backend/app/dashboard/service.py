from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import PermissionDeniedError
from app.learning.service import learning_progress_refs
from app.learning.models import LearningPathEnrollment
from app.research import repository as research_repo
from app.research import service as research_service
from app.research.domain import OPEN_TASK_STATUSES, TaskStatus
from app.research.models import Project, Task
from app.dashboard.schemas import MyDashboardOut, NeedsAttentionOut, TeamOverviewOut, UpcomingItemOut
from app.team.service import list_researchers
from app.users.domain import Commitment, ResearchStatus
from app.users.models import User
from app.users.schemas import UserRef, WorkloadOut
from app.users.workload import CapacityState, workload_for


def my_dashboard(db: Session, user: User) -> MyDashboardOut:
    now = datetime.now(UTC)
    week_end = now + timedelta(days=7)
    tasks = research_service.list_tasks(db, user, assignee_user_id=user.user_id)
    open_tasks = [t for t in tasks if t.status != TaskStatus.COMPLETED]
    completed = sorted((t for t in tasks if t.status == TaskStatus.COMPLETED), key=lambda t: t.completed_at, reverse=True)

    # "Current project" = where most of my open work is.
    counts: dict = {}
    for t in open_tasks:
        counts[t.project_id] = counts.get(t.project_id, 0) + 1
    current_project = None
    project_ids = research_repo.active_member_project_ids(db, user.user_id)
    candidate = max(counts, key=counts.get) if counts else (project_ids[0] if project_ids else None)
    if candidate:
        project = db.get(Project, candidate)
        if project and not project.is_archived:
            [current_project] = research_service.summarize_projects(db, [project])

    upcoming = [
        UpcomingItemOut(due=t.deadline_at, label=t.title, kind="task_deadline", link=f"/projects/{t.project_id}/tasks/{t.task_id}")
        for t in open_tasks
        if t.deadline_at and t.deadline_at >= now - timedelta(days=1)
    ]
    for project in db.scalars(
        select(Project).where(Project.project_id.in_(project_ids), Project.target_date.is_not(None), Project.is_archived.is_(False))
    ):
        if project.target_date >= now.date():
            upcoming.append(UpcomingItemOut(due=project.target_date, label=f"{project.name} target date", kind="project_target", link=f"/projects/{project.project_id}"))
    enrollment = db.get(LearningPathEnrollment, user.user_id)
    if enrollment and enrollment.target_date and not enrollment.completed_at:
        upcoming.append(UpcomingItemOut(due=enrollment.target_date, label="Learning path target", kind="learning_target", link="/learning"))
    upcoming.sort(key=lambda u: u.due if isinstance(u.due, datetime) else datetime(u.due.year, u.due.month, u.due.day, tzinfo=UTC))

    workload = workload_for(db, user.user_id)
    return MyDashboardOut(
        display_name=user.display_name,
        research_status=user.research_status,
        workload=WorkloadOut.of(workload),
        tasks_due_this_week=sum(1 for t in open_tasks if t.deadline_at and t.deadline_at <= week_end),
        overdue_task_count=sum(1 for t in open_tasks if t.is_overdue),
        current_project=current_project,
        open_tasks=open_tasks[:8],
        recently_completed_tasks=completed[:3],
        upcoming=upcoming[:6],
        learning=learning_progress_refs(db, [user.user_id]).get(user.user_id),
    )


def team_overview(db: Session, actor: User) -> TeamOverviewOut:
    if not actor.is_manager:
        raise PermissionDeniedError("Only project managers can view the team overview")
    team = list_researchers(db, actor)
    by_status = {s: sum(1 for r in team if r.research_status == s) for s in ResearchStatus}
    projects = research_service.list_projects(db, actor)
    projects.sort(key=lambda p: (-p.stats.open_task_count, p.name.lower()))

    open_tasks = research_service.list_tasks(db, actor, statuses=list(OPEN_TASK_STATUSES))
    unassigned = db.scalar(
        select(func.count()).where(
            Task.assignee_user_id.is_(None), Task.status.in_(OPEN_TASK_STATUSES), Task.is_archived.is_(False)
        )
    )
    ref = lambda r: UserRef(user_id=r.user_id, display_name=r.display_name)  # noqa: E731
    team_by_load = sorted(
        team,
        key=lambda r: -(r.workload.assigned_hours / r.workload.capacity_hours if r.workload.capacity_hours else r.workload.assigned_hours),
    )
    return TeamOverviewOut(
        researcher_count=len(team),
        learning_path_count=by_status[ResearchStatus.LEARNING_PATH],
        research_count=by_status[ResearchStatus.RESEARCH],
        shadow_count=sum(1 for r in team if r.commitment == Commitment.SHADOW),
        full_time_count=sum(1 for r in team if r.commitment == Commitment.FULL_TIME),
        committed_hours_total=round(sum(r.workload.committed_hours for r in team), 1),
        capacity_hours_total=round(sum(r.workload.capacity_hours for r in team), 1),
        assigned_hours_total=round(sum(r.workload.assigned_hours for r in team), 1),
        team=team_by_load,
        projects=projects,
        needs_attention=NeedsAttentionOut(
            overloaded_researchers=[ref(r) for r in team if r.workload.capacity_state == CapacityState.OVERLOADED],
            researchers_without_availability=[
                ref(r) for r in team if r.workload.capacity_state == CapacityState.NO_AVAILABILITY
            ],
            overdue_tasks=[t for t in open_tasks if t.is_overdue][:10],
            blocked_tasks=[t for t in open_tasks if t.status == TaskStatus.BLOCKED][:10],
            unassigned_open_task_count=unassigned or 0,
        ),
        recent_activity=research_service.recent_activity(db, None, limit=10),
    )
