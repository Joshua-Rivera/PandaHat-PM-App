import uuid
from datetime import time

from pydantic import BaseModel, ConfigDict, Field, model_validator

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class AvailabilityBlockIn(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    weekday: int = Field(ge=0, le=6, description="0 = Monday … 6 = Sunday")
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def _ordered(self) -> "AvailabilityBlockIn":
        if self.end_time <= self.start_time:
            raise ValueError(f"{WEEKDAY_NAMES[self.weekday]}: end time must be after start time")
        return self


class AvailabilityBlockOut(AvailabilityBlockIn):
    pass


class AvailabilityReplaceRequest(BaseModel):
    """PUT semantics: the request is the researcher's complete weekly schedule."""

    blocks: list[AvailabilityBlockIn] = Field(max_length=60)

    @model_validator(mode="after")
    def _no_overlaps(self) -> "AvailabilityReplaceRequest":
        by_day = sorted(self.blocks, key=lambda b: (b.weekday, b.start_time))
        for previous, current in zip(by_day, by_day[1:]):
            if previous.weekday == current.weekday and current.start_time < previous.end_time:
                raise ValueError(f"{WEEKDAY_NAMES[current.weekday]}: time blocks overlap")
        return self


class TeamMemberAvailabilityOut(BaseModel):
    user_id: uuid.UUID
    display_name: str
    role: str
    research_status: str
    commitment: str
    committed_hours: float
    weekly_capacity_hours: float
    assigned_hours: float
    blocks: list[AvailabilityBlockOut]


class AvailabilityOut(BaseModel):
    blocks: list[AvailabilityBlockOut]
    weekly_capacity_hours: float
    assigned_hours: float
