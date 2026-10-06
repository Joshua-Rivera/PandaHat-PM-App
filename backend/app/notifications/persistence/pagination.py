"""Opaque keyset-pagination cursors.

A cursor encodes the (created_at, notification_id) of the last item on the
previous page. The next page is "everything strictly older than that pair".
The id is the tiebreaker, because two notifications can share a timestamp.
"""

import base64
import json
from dataclasses import dataclass
from datetime import datetime


class InvalidCursorError(ValueError):
    pass


@dataclass(frozen=True)
class FeedCursor:
    created_at: datetime
    notification_id: int

    def encode(self) -> str:
        raw = json.dumps([self.created_at.isoformat(), self.notification_id])
        return base64.urlsafe_b64encode(raw.encode()).decode()

    @classmethod
    def decode(cls, token: str) -> "FeedCursor":
        try:
            created_at, notification_id = json.loads(base64.urlsafe_b64decode(token.encode()))
            return cls(datetime.fromisoformat(created_at), int(notification_id))
        except (ValueError, TypeError) as exc:
            raise InvalidCursorError("Malformed cursor") from exc
