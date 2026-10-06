import uuid
from datetime import time

from sqlalchemy import BigInteger, ForeignKey, Identity, SmallInteger, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AvailabilityBlock(Base):
    """A weekly recurring window a researcher can work, e.g. Monday 15:00–18:00."""

    __tablename__ = "availability_blocks"

    availability_block_id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"))
    weekday: Mapped[int] = mapped_column(SmallInteger)  # 0 = Monday … 6 = Sunday
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
