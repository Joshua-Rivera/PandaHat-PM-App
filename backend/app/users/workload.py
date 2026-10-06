"""Capacity vs. assigned work, computed in SQL for any set of users.

capacity_hours  = sum of the user's weekly availability blocks
committed_hours = what their commitment tag promises (Shadow 5 h, Full-time 10 h)
assigned_hours  = sum of estimated_hours of their open (not completed, not archived) tasks

This is the single definition used by the dashboard, Team, Workload and the
assignee picker, so the numbers always agree.
"""

import uuid
from dataclasses import dataclass
from enum import StrEnum

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.availability.models import AvailabilityBlock
from app.research.domain import OPEN_TASK_STATUSES
from app.research.models import Task
from app.users.domain import COMMITMENT_HOURS
from app.users.models import User


class CapacityState(StrEnum):
    NO_AVAILABILITY = "NO_AVAILABILITY"
    AVAILABLE = "AVAILABLE"
    AT_CAPACITY = "AT_CAPACITY"
    OVERLOADED = "OVERLOADED"


@dataclass(frozen=True)
class Workload:
    capacity_hours: float
    assigned_hours: float
    open_task_count: int
    committed_hours: float = 0.0

    @property
    def below_commitment(self) -> bool:
        """Their availability doesn't cover the hours their tag commits them to."""
        return self.capacity_hours < self.committed_hours

    @property
    def state(self) -> CapacityState:
        if self.capacity_hours <= 0:
            return CapacityState.OVERLOADED if self.assigned_hours > 0 else CapacityState.NO_AVAILABILITY
        if self.assigned_hours > self.capacity_hours:
            return CapacityState.OVERLOADED
        if self.assigned_hours >= self.capacity_hours * 0.9:
            return CapacityState.AT_CAPACITY
        return CapacityState.AVAILABLE


def workloads_for(db: Session, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, Workload]:
    if not user_ids:
        return {}
    block_seconds = extract("epoch", AvailabilityBlock.end_time - AvailabilityBlock.start_time)
    capacity = dict(
        db.execute(
            select(AvailabilityBlock.user_id, func.sum(block_seconds) / 3600)
            .where(AvailabilityBlock.user_id.in_(user_ids))
            .group_by(AvailabilityBlock.user_id)
        ).all()
    )
    assigned = {
        row.assignee_user_id: row
        for row in db.execute(
            select(
                Task.assignee_user_id,
                func.coalesce(func.sum(Task.estimated_hours), 0).label("hours"),
                func.count().label("open_count"),
            )
            .where(
                Task.assignee_user_id.in_(user_ids),
                Task.status.in_(OPEN_TASK_STATUSES),
                Task.is_archived.is_(False),
            )
            .group_by(Task.assignee_user_id)
        )
    }
    commitments = dict(db.execute(select(User.user_id, User.commitment).where(User.user_id.in_(user_ids))).all())
    result = {}
    for user_id in user_ids:
        row = assigned.get(user_id)
        result[user_id] = Workload(
            capacity_hours=round(float(capacity.get(user_id) or 0), 1),
            assigned_hours=round(float(row.hours), 1) if row else 0.0,
            open_task_count=int(row.open_count) if row else 0,
            committed_hours=COMMITMENT_HOURS.get(commitments.get(user_id), 0.0),
        )
    return result


def workload_for(db: Session, user_id: uuid.UUID) -> Workload:
    return workloads_for(db, [user_id])[user_id]
