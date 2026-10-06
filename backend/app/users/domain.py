from enum import StrEnum


class Role(StrEnum):
    """Stored lowercase for backwards compatibility with migration 0001.
    The UI labels them Researcher / Project Manager / Admin."""

    RESEARCHER = "researcher"
    PROJECT_MANAGER = "pm"
    ADMIN = "admin"


MANAGER_ROLES = (Role.PROJECT_MANAGER, Role.ADMIN)


class ResearchStatus(StrEnum):
    """The track tag a PM gives each member: still on the Learning Path, or doing Research."""

    LEARNING_PATH = "LEARNING_PATH"
    RESEARCH = "RESEARCH"


class Commitment(StrEnum):
    """How much a member has signed up for. Shadow researchers commit 5 h/week, full-time 10 h/week."""

    SHADOW = "SHADOW"
    FULL_TIME = "FULL_TIME"


COMMITMENT_HOURS: dict[str, float] = {Commitment.SHADOW: 5.0, Commitment.FULL_TIME: 10.0}


class AccessStatus(StrEnum):
    """Real sign-in: people who sign in with an unknown GitHub account wait for a PM."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
