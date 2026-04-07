#!/usr/bin/env bash
# Cloud Run へデプロイする例（要: gcloud CLI・Docker・課金有効プロジェクト）
# 事前: Artifact Registry または gcr.io、GOOGLE_REDIRECT_URI を本番 URL に合わせる
#
# 使い方:
#   cd web
#   export GCP_PROJECT_ID=your-project-id
#   ./scripts/deploy-cloud-run.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-asia-northeast1}"
SERVICE="${SERVICE_NAME:-altan-orda-web}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}:latest"

echo "Building image: ${IMAGE}"
gcloud builds submit --tag "${IMAGE}" --project "${PROJECT_ID}" .

echo "Deploying Cloud Run service: ${SERVICE}"
gcloud run deploy "${SERVICE}" \
  --project "${PROJECT_ID}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars "NODE_ENV=production"

echo "Set secrets / env in Cloud Run console:"
echo "  OPENAI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,"
echo "  GOOGLE_REDIRECT_URI=https://<service-url>/api/auth/google/callback"
echo "  AO_SESSION_SECRET"
