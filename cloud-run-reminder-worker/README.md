# Cloud Run reminder worker

This replaces the scheduled Firebase Function. It runs once, finds due reminders
in Firestore, sends FCM data messages, updates `nextDueAt`, then exits.

## One-time Cloud Shell setup and deployment

Run these commands from the repository root in Cloud Shell. They use Bangkok for
the worker, which matches the Firestore database location.

```bash
PROJECT_ID=times-the-calendar
REGION=asia-southeast3
SCHEDULER_REGION=asia-southeast1
JOB_NAME=reminder-due-worker
SCHEDULER_SA=reminder-scheduler@$PROJECT_ID.iam.gserviceaccount.com
WORKER_SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com firebasecloudmessaging.googleapis.com

gcloud iam service-accounts create reminder-scheduler \
  --display-name="Reminder scheduler"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$WORKER_SA" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$WORKER_SA" \
  --role="roles/firebasecloudmessaging.admin"

gcloud run jobs deploy "$JOB_NAME" \
  --source ./cloud-run-reminder-worker \
  --region "$REGION" \
  --service-account "$WORKER_SA" \
  --task-timeout 5m \
  --max-retries 1

gcloud run jobs add-iam-policy-binding "$JOB_NAME" \
  --region "$REGION" \
  --member="serviceAccount:$SCHEDULER_SA" \
  --role="roles/run.invoker"

gcloud scheduler jobs create http reminder-due-every-minute \
  --location "$SCHEDULER_REGION" \
  --schedule="* * * * *" \
  --time-zone="Asia/Bangkok" \
  --uri="https://run.googleapis.com/v2/projects/$PROJECT_ID/locations/$REGION/jobs/$JOB_NAME:run" \
  --http-method=POST \
  --oauth-service-account-email="$SCHEDULER_SA"
```

Before creating the schedule, run one manual test:

```bash
gcloud run jobs execute reminder-due-worker --region asia-southeast3 --wait
gcloud run jobs executions list --job reminder-due-worker --region asia-southeast3
```

The job uses the project Compute Engine default service account, which has been
explicitly granted Firestore and Firebase Cloud Messaging permissions above. Cloud
Scheduler is in Singapore because Cloud Scheduler does not currently offer a
Bangkok region; the job itself still runs in Bangkok beside Firestore.

Do not deploy `functions/index.js` after switching; it is retained only as the
previous Firebase Functions implementation until this job has been verified.
