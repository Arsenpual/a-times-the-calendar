# Backend auto-deploy

Service: `times-the-calendar-backend` (`srv-d9qcdbrm8hqs73871mlg`).
Repository: `Arsenpual/a-times-the-calendar`, branch `main`.

## GitHub side

`.github/workflows/backend-ci.yml` runs backend tests on every push to main,
including commits that do not change the frontend. No production credentials
are needed. It provides a check for Render's **After CI Checks Pass** setting.
The workflow itself does not call Render or change service settings.

The frontend Pages workflow is path-filtered. Without Backend CI, a backend-only
commit can have zero checks. Render documents that such commits do not trigger
deploys in After CI Checks Pass mode.

## Render settings to verify

In Settings → Build & Deploy:

- Link the GitHub repository through the GitHub integration, with branch `main`.
- Select **After CI Checks Pass** to deploy after checks succeed, or **On Commit**
  if deployments should start immediately without waiting for frontend checks.
- Ensure Auto-Deploy is not **Off**. Deploying a specific commit or rolling back
  in the dashboard can disable automatic deploys.
- Check build filters include the backend and any shared runtime source it uses.

These dashboard settings cannot be inferred from GitHub deployment history.
Do not consider the issue resolved until a new push starts a Render deployment
without pressing Manual Deploy, and its commit SHA matches the push.

Reference: https://render.com/docs/deploys
