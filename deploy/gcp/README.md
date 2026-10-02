# Google Cloud Run deployment

Harbor runs as two Cloud Run services: the NestJS API and a static React app served by unprivileged NGINX. PostgreSQL runs in Cloud SQL. The API connects through Cloud Run's Cloud SQL integration over its Unix socket.

## Prerequisites

Set `PROJECT_ID`, `REGION`, `REPOSITORY`, `API_SERVICE`, `WEB_SERVICE`, `SQL_INSTANCE`, `SQL_DATABASE`, `SQL_USER`, `RUNTIME_SERVICE_ACCOUNT`, `DB_PASSWORD_SECRET`, `JWT_SECRET_NAME`, `FIREBASE_ADMIN_SECRET`, `ADMIN_EMAIL`, `GIT_SHA`, and the `VITE_FIREBASE_*` values for the deployment. Use separate names and credentials for each environment.

Enable Cloud Run, Artifact Registry, Cloud Build, Cloud SQL Admin, and Secret Manager APIs. Create an Artifact Registry Docker repository in `REGION`, a Cloud SQL PostgreSQL instance, and the SQL database and application user. For production, use a dedicated-core Cloud SQL instance with high availability, automated backups, point-in-time recovery, and an agreed restore procedure. Shared-core instances are for development and testing only.

Create a runtime service account for Harbor. Grant it `roles/cloudsql.client` on the project and `roles/secretmanager.secretAccessor` on only the secrets it needs. Grant the Cloud Build service account `roles/artifactregistry.writer` on the image repository and the permissions required to write build logs. Do not use the project Editor role as the API runtime identity.

Store `JWT_SECRET`, the database password, and the Firebase Admin service-account JSON in Secret Manager. Use a unique 32-byte-or-longer JWT secret. The Firebase web API key, auth domain, project ID, and app ID are public client configuration; pass those only to the web build.

## Build the API image

The Cloud Build files build the production Dockerfiles and push immutable build tags to Artifact Registry. Build the API from the repository root with the project, region, and repository values set:

```sh
API_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/api:$GIT_SHA"
WEB_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/web:$GIT_SHA"

(cd api && gcloud builds submit . \
  --project="$PROJECT_ID" --region="$REGION" --config=cloudbuild.yaml \
  --substitutions="_IMAGE=$API_IMAGE")
```

The API image has no build-time secrets. The web config is embedded in the browser bundle, so never pass private credentials as Vite variables.

## Run migrations and deploy

Run migrations as a one-task Cloud Run Job before changing the API service. The API process never runs schema migrations on replica startup. Use the same API image, runtime service account, Cloud SQL instance, and database settings for the migration job and API service:

```sh
INSTANCE_CONNECTION_NAME="$PROJECT_ID:$REGION:$SQL_INSTANCE"

gcloud run jobs deploy "$API_SERVICE-migrate" \
  --project="$PROJECT_ID" --region="$REGION" \
  --image="$API_IMAGE" --command=node --args=dist/run-migrations.js \
  --service-account="$RUNTIME_SERVICE_ACCOUNT" \
  --set-cloudsql-instances="$INSTANCE_CONNECTION_NAME" \
  --set-env-vars="NODE_ENV=production,CLOUD_SQL_INSTANCE=$INSTANCE_CONNECTION_NAME,DB_NAME=$SQL_DATABASE,DB_USER=$SQL_USER,DB_POOL_MAX=1" \
  --set-secrets="DB_PASSWORD=$DB_PASSWORD_SECRET:latest" \
  --tasks=1 --max-retries=0 --task-timeout=10m

gcloud run jobs execute "$API_SERVICE-migrate" \
  --project="$PROJECT_ID" --region="$REGION" --wait
```

Deploy the API first with a temporary valid HTTPS `WEB_ORIGIN`, then build and deploy the web image with the API URL embedded. Update the API's `WEB_ORIGIN` to the web service's exact HTTPS origin when its URL is known:

```sh
gcloud run deploy "$API_SERVICE" \
  --project="$PROJECT_ID" --region="$REGION" \
  --image="$API_IMAGE" --port=8080 --service-account="$RUNTIME_SERVICE_ACCOUNT" \
  --add-cloudsql-instances="$INSTANCE_CONNECTION_NAME" \
  --set-env-vars="NODE_ENV=production,AUTH_MODE=firebase,WEB_ORIGIN=https://pending.invalid,CLOUD_SQL_INSTANCE=$INSTANCE_CONNECTION_NAME,DB_NAME=$SQL_DATABASE,DB_USER=$SQL_USER,DB_POOL_MAX=5,ADMIN_EMAIL=$ADMIN_EMAIL" \
  --set-secrets="DB_PASSWORD=$DB_PASSWORD_SECRET:latest,JWT_SECRET=$JWT_SECRET_NAME:latest,FIREBASE_SERVICE_ACCOUNT_JSON=$FIREBASE_ADMIN_SECRET:latest" \
  --cpu=1 --memory=1Gi --concurrency=40 --min=0 --max=5 \
  --startup-probe="httpGet.path=/api/health,httpGet.port=8080,periodSeconds=5,failureThreshold=12" \
  --readiness-probe="httpGet.path=/api/ready,httpGet.port=8080,periodSeconds=10,failureThreshold=3" \
  --liveness-probe="httpGet.path=/api/health,httpGet.port=8080,periodSeconds=30,failureThreshold=3" \
  --allow-unauthenticated

API_URL="$(gcloud run services describe "$API_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"

(cd web && gcloud builds submit . \
  --project="$PROJECT_ID" --region="$REGION" --config=cloudbuild.yaml \
  --substitutions="_IMAGE=$WEB_IMAGE,_VITE_API_URL=$API_URL/api,_VITE_AUTH_MODE=firebase,_VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY,_VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN,_VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID,_VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID")

# Build and deploy WEB_IMAGE with VITE_API_URL="$API_URL/api".
gcloud run deploy "$WEB_SERVICE" \
  --project="$PROJECT_ID" --region="$REGION" \
  --image="$WEB_IMAGE" --port=8080 \
  --cpu=1 --memory=256Mi --concurrency=80 --min=0 --max=5 \
  --allow-unauthenticated

WEB_URL="$(gcloud run services describe "$WEB_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
gcloud run services update "$API_SERVICE" \
  --project="$PROJECT_ID" --region="$REGION" \
  --update-env-vars="WEB_ORIGIN=$WEB_URL"
```

The web service is public so staff browsers can load the app. The API's application authentication still controls CRM data access. `AUTH_MODE=firebase` requires verified Firebase accounts; authorize the intended admin email in Firebase before first sign-in. Use Cloud Run IAM restrictions only when a Google-authenticated gateway is placed in front of the browser app.

## Verify and operate

- Check `/api/health` for process liveness and `/api/ready` for database connectivity.
- Confirm the API allows only the web service's exact origin through CORS.
- Verify Firebase sign-in, the admin bootstrap, staff provisioning, and the user-role workflows before onboarding staff.
- Monitor Cloud Run revision health, logs, request latency, database connections, storage, backups, and restore readiness.
- Apply schema changes through the migration job. Test migrations against a database copy before production changes.
- Keep production and test projects, databases, secrets, and Firebase environments separate.

The repository's root Docker Compose stack remains the local development workflow. It explicitly builds `Dockerfile.dev`; Cloud Run and Cloud Build use the production `Dockerfile` in each service directory.
