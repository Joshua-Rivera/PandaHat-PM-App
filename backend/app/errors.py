"""Domain errors raised by service functions.

Services must not import FastAPI, so they raise these instead of HTTPException.
`register_error_handlers` (called from main.py) turns them into HTTP responses
with the same `{"detail": ...}` shape FastAPI uses, so the frontend handles
every error the same way.
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class DomainError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, detail: str, *, field: str | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.field = field  # lets a form show the message next to the right input


class NotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND


class PermissionDeniedError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN


class ConflictError(DomainError):
    status_code = status.HTTP_409_CONFLICT


class InvalidInputError(DomainError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _handle_domain_error(_request: Request, exc: DomainError) -> JSONResponse:
        body: dict = {"detail": exc.detail}
        if exc.field:
            body["field"] = exc.field
        return JSONResponse(status_code=exc.status_code, content=body)
