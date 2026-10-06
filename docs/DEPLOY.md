# Deploying PandaHat (Phase B)

What runs where:

| Piece | Service | Cost at our size |
| --- | --- | --- |
| Next.js frontend | Firebase App Hosting | free tier |
| Sign in with GitHub | Firebase Authentication | free |
| FastAPI backend | Cloud Run (`pandahat-api`) | free tier (scales to zero) |
| PostgreSQL | Neon | free tier |
| Secrets | Google Secret Manager | free tier |

The browser only talks to the App Hosting site. Next.js forwards `/api/*` to Cloud Run with the
`Authorization: Bearer <Firebase ID token>` header, and FastAPI checks that token on every request.

App Hosting and Cloud Run both need the Firebase project on the **Blaze (pay-as-you-go)** plan. Usage stays
inside the free quotas, but a billing account must be attached. Set a budget alert (step 2) so nobody is surprised.

---

## 1. Database: Neon

1. Create a project at neon.tech (region close to your Cloud Run region, e.g. `us-east-1` ↔ `us-east1`).
2. Copy the **pooled** connection string. It looks like `postgresql://user:pass@ep-xxx-pooler.../neondb?sslmode=require`.
   The backend accepts it as is; it switches the driver to psycopg itself.
3. You don't need to create any tables. The backend runs `alembic upgrade head` every time it starts.

## 2. Firebase project

1. Go to console.firebase.google.com, choose **Add project** and name it `pandahat`. Upgrade it to **Blaze** and
   add a budget alert (for example $5) under Google Cloud → Billing → Budgets.
2. **Authentication → Sign-in method → GitHub → Enable.** Firebase shows a callback URL
   (`https://<project>.firebaseapp.com/__/auth/handler`).
3. In GitHub, open the **Adversarial-Fall-2026 org → Settings → Developer settings → OAuth Apps → New OAuth App**:
   - Homepage URL: your App Hosting URL (you can fill it in after step 4).
   - Authorization callback URL: the Firebase callback URL from step 2.
   - Copy the Client ID and generate a Client secret, then paste both into the Firebase GitHub provider.
4. **Project settings → Your apps → Web app (</>)**. Copy `apiKey`, `authDomain`, `projectId` and `appId` into
   `frontend/apphosting.yaml`. These values are public; they aren't secrets.
5. **Authentication → Settings → Authorized domains**: add your App Hosting domain (and any custom domain).

## 3. Backend on Cloud Run

Run these in Cloud Shell or with the `gcloud` CLI. The Firebase project *is* the Google Cloud project.

```bash
gcloud config set project YOUR_FIREBASE_PROJECT_ID
```

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

Store the secrets. Paste the Neon string when prompted, then press Ctrl-D:

```bash
gcloud secrets create pandahat-database-url --data-file=-
```

```bash
printf 'you@example.com,other.pm@example.com' | gcloud secrets create pandahat-bootstrap-admins --data-file=-
```

`BOOTSTRAP_ADMIN_EMAILS` lists the people who become admins on their first GitHub sign-in. Use the email on their
GitHub account. Everyone else waits for approval on **Team**.

First deploy (from the repo root):

```bash
gcloud run deploy pandahat-api --source backend --region us-east1 --allow-unauthenticated --set-env-vars ENVIRONMENT=production,AUTH_MODE=firebase,FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID --set-secrets DATABASE_URL=pandahat-database-url:latest,BOOTSTRAP_ADMIN_EMAILS=pandahat-bootstrap-admins:latest
```

`--allow-unauthenticated` is correct here: Cloud Run lets the request in, and FastAPI rejects anything without a
valid Firebase token. Give the service's runtime service account the **Secret Manager Secret Accessor** role if the
deploy reports it can't read the secrets.

Check it: `https://<cloud-run-url>/healthz` should return `{"status":"ok"}`, and `/api/v1/me` should return 401.

## 4. Frontend on Firebase App Hosting

1. Put `BACKEND_URL` (the Cloud Run URL) and the four Firebase values in `frontend/apphosting.yaml`, then commit.
2. In the Firebase console, open **App Hosting → Get started**. Connect the GitHub repo, set the **root directory**
   to `frontend` and the live branch to `main`.
3. Every push to `main` now rebuilds and deploys the site. Add the resulting `*.hosted.app` domain to
   **Authorized domains** (step 2.5) and to the GitHub OAuth App's homepage URL.
4. Set `APP_BASE_URL` on Cloud Run to that address. Phase E email links will use it.

## 5. Automatic backend deploys (optional, recommended)

`.github/workflows/deploy-backend.yml` redeploys Cloud Run after CI passes on `main`. It uses Workload Identity
Federation, so no Google key is stored in GitHub. Follow the one-time setup in the google-github-actions/auth README
("Direct Workload Identity Federation"). Then add these **repository variables** (Settings → Secrets and
variables → Actions → Variables):

| Variable | Example |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/123/locations/global/workloadIdentityPools/github/providers/github` |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `deployer@pandahat.iam.gserviceaccount.com` |
| `GCP_REGION` | `us-east1` |
| `FIREBASE_PROJECT_ID` | `pandahat` |
| `APP_BASE_URL` | `https://pandahat--pandahat.us-east4.hosted.app` |

## 6. First sign-in

1. A bootstrap admin opens the site and chooses **Sign in with GitHub**. They become an admin straight away.
2. Everyone else signs in the same way:
   - If a PM already added their email on **Team → Add member**, they link to that profile automatically.
   - Otherwise they see "Waiting for approval". A PM approves them on **Team** and sets their role, their **track**
     (Learning Path or Research) and their **commitment** (Shadow 5 h/week or Full-time 10 h/week).
3. Members set their weekly availability. PMs see everyone's on **Team Availability**.

## Local development

Nothing changes: `AUTH_MODE=dev` and `NEXT_PUBLIC_AUTH_MODE=dev` keep the "Viewing as" switcher. To try real GitHub
sign-in on your laptop:
- Set `AUTH_MODE=firebase` and `FIREBASE_PROJECT_ID` in `backend/.env`.
- Set `NEXT_PUBLIC_AUTH_MODE=firebase` and the four Firebase values in `frontend/.env.local`.
- `localhost` is an authorized domain by default.

The backend refuses to start with `AUTH_MODE=dev` when `ENVIRONMENT=production`.
