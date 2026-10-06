import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth_router import router as auth_router
from app.availability.router import router as availability_router
from app.availability.router import team_router as team_availability_router
from app.config import allowed_origins, get_settings
from app.dashboard.router import router as dashboard_router
from app.errors import register_error_handlers
from app.learning.router import me_router as learning_me_router
from app.learning.router import router as learning_router
from app.notifications.api.announcements_router import router as announcements_router
from app.notifications.api.notifications_router import router as notifications_router
from app.research.router import projects_router
from app.research.router import router as research_router
from app.team.router import router as team_router
from app.users.router import me_router as users_me_router
from app.users.router import router as users_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

settings = get_settings()

app = FastAPI(title="PandaHat Research Operations API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

for r in (
    auth_router,
    users_me_router,
    users_router,
    team_router,
    projects_router,
    research_router,
    availability_router,
    team_availability_router,
    learning_me_router,
    learning_router,
    dashboard_router,
    notifications_router,
    announcements_router,
):
    app.include_router(r)

if settings.is_dev_auth:
    # Only exists when the header-based dev identity is on; see app/dev/router.py.
    from app.dev.router import router as dev_router

    app.include_router(dev_router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
