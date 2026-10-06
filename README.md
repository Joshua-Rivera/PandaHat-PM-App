# PandaHat Research Operations

Next.js + TypeScript → FastAPI → PostgreSQL (→ GitHub API, Resend in later phases).

A research-group project manager built around the PandaHat lifecycle:
**Learning Path → Research → active research projects**. Each member also has a commitment tag (Shadow researcher 5 h/week, Full-time researcher 10 h/week),
with tasks, availability/capacity and notifications around it. There are two experiences:

- **Researchers** see My Work, their projects, their learning path, and enter their own availability.
- **Project managers** also get Team, Workload, Manage Projects and learning-path management. They create projects and tasks, and assign people by name.

Everything is created through the UI. The seed script is optional demo data.

## Run it

```bash
docker compose up -d db
```

```bash
cd backend && python3.13 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
```

```bash
cd backend && .venv/bin/alembic upgrade head
```

Optional demo data (4 people, 3 projects, tasks, availability and a learning path):

```bash
cd backend && .venv/bin/python -m scripts.seed_dev
```

```bash
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend && npm install && cp -n .env.example .env.local && npm run dev
```

Open http://localhost:3000. In development there's no sign-in: use **Viewing as** in the header to act as any team member. On an empty database, the app offers to create the first project manager, and you build the rest from **Team → Add member**. API docs are at http://localhost:8000/docs.

> **Deploying?** See [docs/DEPLOY.md](docs/DEPLOY.md): Sign in with GitHub through Firebase Auth, Next.js on Firebase App Hosting, FastAPI on Cloud Run, Postgres on Neon.

> **Dev identity is development-only.** `AUTH_MODE=dev` (backend) and `NEXT_PUBLIC_AUTH_MODE=dev` (frontend) make the server trust an `X-Dev-User-Id` header. The backend refuses to start with `AUTH_MODE=dev` when `ENVIRONMENT=production`, and the `/api/v1/dev/*` routes only exist in dev mode. Real auth replaces `app/auth.py:get_current_user` and `frontend/lib/auth/session.ts`. Nothing else changes.

## Checks

```bash
cd backend && .venv/bin/pytest
```

```bash
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```

Backend tests use a real Postgres (`pandahat_test`, created by docker compose).

## Layout

```
backend/app/
  auth.py                 dev identity + CurrentUser / ManagerUser dependencies (server-side role checks)
  errors.py               domain errors → {"detail", "field"} HTTP responses
  users/                  User model, Role/ResearchStatus, /me, /users, workload.py (capacity maths)
  team/                   /researchers: team list, researcher profile, research status changes
  research/               projects, project members, tasks (router → service → repository)
  availability/           weekly availability blocks, /me/availability
  learning/               learning paths → modules → tasks, enrolment, progress
  dashboard/              /me/dashboard (researcher) and /overview (PM) aggregates
  notifications/          events → in-app notifications (see Notification design report)
  dev/                    dev-only identity list + first-PM bootstrap
frontend/
  lib/api/                typed client (function names = FastAPI operation_ids) + types
  lib/queries/            TanStack Query hooks; mutations refresh related data
  lib/dev/devIdentity.ts  the only place that knows about the dev identity
  components/shell/       AppShell, AppSidebar, RoleSwitcher ("Viewing as"), UserMenu, SessionGate
  components/ui/          Skeletons, EmptyState, ErrorState, Dialog, Toast, form fields, badges, CapacityBar
  components/{projects,tasks,team,learning,availability,dashboard,notifications}/
  app/                    routes: /, /my-work, /projects, /projects/[id], /projects/[id]/tasks/[id],
                          /projects/manage, /learning, /availability, /team, /team/[id], /workload,
                          /notifications, /settings
```
