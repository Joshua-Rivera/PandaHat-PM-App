"""OPTIONAL demo data for local development.

Seeds are for developer setup, demos and screenshots, NOT for operating
PandaHat. Everything created here can also be created from the UI (and a PM can
start from an empty database: the "Viewing as" menu offers to create the first
PM). The script goes through the same service functions as the API, so seeded
tasks generate real notifications.

Usage (from backend/):  .venv/bin/python -m scripts.seed_dev
Safe to re-run: existing rows are left alone.
"""

import uuid
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import func, select

from app.availability.schemas import AvailabilityBlockIn, AvailabilityReplaceRequest
from app.availability.service import replace_availability
from app.db import SessionLocal
from app.learning import service as learning_service
from app.learning.models import LearningPath
from app.learning.schemas import LearningModuleIn, LearningPathCreate, LearningTaskIn
from app.research import service as research
from app.research.models import Project, Task
from app.research.schemas import ProjectCreate, TaskCreate, TaskUpdate
from app.users.domain import Commitment, ResearchStatus, Role
from app.users.models import User

PM_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
RESEARCHER_ID = uuid.UUID("00000000-0000-4000-8000-000000000002")
RESEARCHER_B_ID = uuid.UUID("00000000-0000-4000-8000-000000000003")
RESEARCHER_C_ID = uuid.UUID("00000000-0000-4000-8000-000000000004")
PROJECT_ID = uuid.UUID("00000000-0000-4000-8000-0000000000a1")

PEOPLE = [
    (PM_ID, "Project Manager Test User", "pm@pandahat.dev", Role.PROJECT_MANAGER, ResearchStatus.RESEARCH,
     Commitment.FULL_TIME, []),
    (RESEARCHER_ID, "Joshua Rivera", "joshua@pandahat.dev", Role.RESEARCHER, ResearchStatus.RESEARCH,
     Commitment.FULL_TIME, ["Python", "PyTorch", "Watermarking"]),
    (RESEARCHER_B_ID, "Researcher B", "researcher.b@pandahat.dev", Role.RESEARCHER, ResearchStatus.LEARNING_PATH,
     Commitment.SHADOW, ["Python"]),
    (RESEARCHER_C_ID, "Researcher C", "researcher.c@pandahat.dev", Role.RESEARCHER, ResearchStatus.RESEARCH,
     Commitment.SHADOW, ["Deepfake detection", "Computer vision"]),
]


def _days(n: int) -> datetime:
    return (datetime.now(UTC) + timedelta(days=n)).replace(hour=23, minute=0, second=0, microsecond=0)


def _upsert_people(db) -> None:
    for user_id, name, email, role, status, commitment, skills in PEOPLE:
        user = db.get(User, user_id)
        if user is None:
            db.add(User(user_id=user_id, display_name=name, email=email, role=role, research_status=status,
                        commitment=commitment, skills=skills, is_email_verified=True))
        else:  # older seeds used other names; bring them in line with the demo
            user.display_name, user.role, user.research_status, user.skills = name, role, status, skills
            user.commitment = commitment
    db.commit()


def _availability(db, user_id, blocks) -> None:
    request = AvailabilityReplaceRequest(blocks=[
        AvailabilityBlockIn(weekday=d, start_time=time(s), end_time=time(e)) for d, s, e in blocks
    ])
    replace_availability(db, user_id, request)


def _project(db, pm, project_id, data: ProjectCreate) -> uuid.UUID:
    existing = db.scalar(select(Project.project_id).where(func.lower(Project.name) == data.name.lower()))
    if existing:
        return existing
    if project_id and db.get(Project, project_id):
        project = db.get(Project, project_id)  # the original seed's project: fill in the new fields
        for key, value in data.model_dump().items():
            setattr(project, key, value)
        project.project_manager_user_id = pm.user_id
        db.commit()
        return project_id
    return research.create_project(db, pm, data).project_id


def _task(db, pm, project_id, **fields) -> None:
    if db.scalar(select(Task.task_id).where(Task.project_id == project_id, Task.title == fields["title"])):
        return
    status = fields.pop("status", "TODO")
    created = research.create_task(db, pm, TaskCreate(project_id=project_id, **fields))
    if status != "TODO":
        research.update_task(db, pm, created.task_id, TaskUpdate(status=status))


def main() -> None:
    with SessionLocal() as db:
        _upsert_people(db)
        pm = db.get(User, PM_ID)

        watermark = _project(db, pm, PROJECT_ID, ProjectCreate(
            name="Watermark Robustness Against Face Swaps",
            description="Measure how well invisible watermarks survive identity-swap manipulations.",
            research_question="Can TrustMark survive face-swap manipulation?",
            hypothesis="Watermark bits embedded outside the facial region remain recoverable after SimSwap.",
            research_track="Watermarking",
            stage="EXPERIMENT_VALIDATION",
            research_lead_user_id=RESEARCHER_ID,
            start_date=date.today() - timedelta(days=30),
            target_date=date.today() + timedelta(days=21),
            github_repository="Adversarial-Fall-2026/Watermarking-And-Deepfakes",
        ))
        localization = _project(db, pm, None, ProjectCreate(
            name="Manipulation Localization",
            description="Locate manipulated regions in partially edited images.",
            research_question="Can we localize face-swap regions at pixel level?",
            research_track="Forensics",
            stage="EXPERIMENT_DESIGN",
            target_date=date.today() + timedelta(days=45),
        ))
        detection = _project(db, pm, None, ProjectCreate(
            name="Deepfake Detection",
            description="Benchmark detectors on modern diffusion-based face swaps.",
            research_track="Detection",
            stage="ANALYSIS",
            target_date=date.today() + timedelta(days=14),
        ))

        _task(db, pm, watermark, title="Evaluate TrustMark after JPEG compression", assignee_user_id=RESEARCHER_ID,
              priority="MEDIUM", estimated_hours=2, deadline_at=_days(5), status="COMPLETED")
        _task(db, pm, watermark, title="Analyze SimSwap results", assignee_user_id=RESEARCHER_ID, priority="HIGH",
              estimated_hours=3, deadline_at=_days(3), status="IN_PROGRESS",
              description="Compare bit accuracy before/after SimSwap on the 500-image validation split.")
        _task(db, pm, watermark, title="Validate TrustMark recovery", assignee_user_id=RESEARCHER_ID, priority="MEDIUM",
              estimated_hours=2, deadline_at=_days(5),
              github_issue_url="https://github.com/Adversarial-Fall-2026/Watermarking-And-Deepfakes/issues/1")
        _task(db, pm, watermark, title="Run SimSwap identity-transfer baseline", assignee_user_id=RESEARCHER_C_ID,
              priority="MEDIUM", estimated_hours=4, deadline_at=_days(-1))
        _task(db, pm, localization, title="Collect partially-swapped dataset", assignee_user_id=RESEARCHER_C_ID,
              priority="HIGH", estimated_hours=6, deadline_at=_days(6), status="BLOCKED",
              description="Blocked on dataset licence approval.")
        _task(db, pm, localization, title="Survey localization literature", priority="LOW", estimated_hours=3)
        _task(db, pm, detection, title="Benchmark detector on DiffSwap", assignee_user_id=RESEARCHER_ID,
              priority="MEDIUM", estimated_hours=3, deadline_at=_days(9))

        _availability(db, RESEARCHER_ID, [(0, 15, 18), (2, 13, 17), (4, 10, 15)])  # 12 h
        _availability(db, RESEARCHER_B_ID, [(1, 14, 18), (3, 14, 18)])              # 8 h
        _availability(db, RESEARCHER_C_ID, [(0, 9, 14), (3, 9, 14)])                # 10 h

        path = db.scalar(select(LearningPath).where(LearningPath.name == "Computer Vision Foundations"))
        if path is None:
            created = learning_service.create_learning_path(db, pm, LearningPathCreate(
                name="Computer Vision Foundations",
                description="From Python basics to reproducing a watermarking paper.",
                modules=[
                    LearningModuleIn(title="Python Fundamentals", tasks=[LearningTaskIn(title="Python for research crash course", estimated_hours=3)]),
                    LearningModuleIn(title="PyTorch Fundamentals", tasks=[LearningTaskIn(title="PyTorch 60-minute blitz", resource_url="https://pytorch.org/tutorials/beginner/deep_learning_60min_blitz.html", estimated_hours=2)]),
                    LearningModuleIn(title="CNN Fundamentals", tasks=[LearningTaskIn(title="Train a CNN on CIFAR-10", estimated_hours=4)]),
                    LearningModuleIn(title="Digital Watermarking", tasks=[
                        LearningTaskIn(title="Read the StegaStamp paper", resource_url="https://arxiv.org/abs/1904.05343", estimated_hours=2),
                        LearningTaskIn(title="Read TrustMark paper", resource_url="https://arxiv.org/abs/2311.18297", estimated_hours=2),
                        LearningTaskIn(title="Embed and decode a TrustMark watermark", estimated_hours=2),
                    ]),
                    LearningModuleIn(title="Paper Reproduction", tasks=[LearningTaskIn(title="Reproduce one robustness table", estimated_hours=6)]),
                    LearningModuleIn(title="Guided Experiment", tasks=[LearningTaskIn(title="Run a guided JPEG-robustness experiment", estimated_hours=4)]),
                ],
            ))
            learning_service.assign_learning_path(db, pm, RESEARCHER_B_ID, created.learning_path_id, date.today() + timedelta(days=30))
            researcher_b = db.get(User, RESEARCHER_B_ID)
            first_four = [t.learning_task_id for m in created.modules for t in m.tasks][:4]
            for task_id in first_four:
                learning_service.set_my_task_completion(db, researcher_b, task_id, True)

    print("Demo data ready. Open http://localhost:3000 and use 'Viewing as' to switch people:")
    for user_id, name, _email, role, _status, _commitment, _skills in PEOPLE:
        print(f"  {name:<28} {role:<10} {user_id}")


if __name__ == "__main__":
    main()
