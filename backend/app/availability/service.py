import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.availability.models import AvailabilityBlock
from app.availability.schemas import (
    AvailabilityBlockOut,
    AvailabilityOut,
    AvailabilityReplaceRequest,
    TeamMemberAvailabilityOut,
)
from app.users.domain import AccessStatus
from app.users.models import User
from app.users.workload import workload_for, workloads_for


def get_availability(db: Session, user_id: uuid.UUID) -> AvailabilityOut:
    blocks = db.scalars(
        select(AvailabilityBlock)
        .where(AvailabilityBlock.user_id == user_id)
        .order_by(AvailabilityBlock.weekday, AvailabilityBlock.start_time)
    )
    workload = workload_for(db, user_id)
    return AvailabilityOut(
        blocks=[AvailabilityBlockOut.model_validate(b) for b in blocks],
        weekly_capacity_hours=workload.capacity_hours,
        assigned_hours=workload.assigned_hours,
    )


def replace_availability(db: Session, user_id: uuid.UUID, request: AvailabilityReplaceRequest) -> AvailabilityOut:
    # Delete + insert in one transaction: readers see the old schedule or the new one, never half.
    db.execute(delete(AvailabilityBlock).where(AvailabilityBlock.user_id == user_id))
    db.add_all(
        AvailabilityBlock(user_id=user_id, weekday=b.weekday, start_time=b.start_time, end_time=b.end_time)
        for b in request.blocks
    )
    db.commit()
    return get_availability(db, user_id)


def team_availability(db: Session) -> list[TeamMemberAvailabilityOut]:
    """Everyone's weekly schedule in one response, for the PM availability table."""
    users = list(
        db.scalars(
            select(User)
            .where(User.is_active.is_(True), User.access_status == AccessStatus.APPROVED)
            .order_by(func.lower(User.display_name))
        )
    )
    ids = [u.user_id for u in users]
    blocks: dict[uuid.UUID, list[AvailabilityBlockOut]] = {i: [] for i in ids}
    for b in db.scalars(
        select(AvailabilityBlock)
        .where(AvailabilityBlock.user_id.in_(ids))
        .order_by(AvailabilityBlock.weekday, AvailabilityBlock.start_time)
    ):
        blocks[b.user_id].append(AvailabilityBlockOut.model_validate(b))
    workloads = workloads_for(db, ids)
    return [
        TeamMemberAvailabilityOut(
            user_id=u.user_id,
            display_name=u.display_name,
            role=u.role,
            research_status=u.research_status,
            commitment=u.commitment,
            committed_hours=u.committed_hours,
            weekly_capacity_hours=workloads[u.user_id].capacity_hours,
            assigned_hours=workloads[u.user_id].assigned_hours,
            blocks=blocks[u.user_id],
        )
        for u in users
    ]
