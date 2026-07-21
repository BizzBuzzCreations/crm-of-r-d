#!/usr/bin/env bash
#
# Deploy script for rndCRM (crm-agencyos).
# Runs ON THE VM, triggered by the self-hosted runner via
# .github/workflows/deploy.yml on every push to main.
set -euo pipefail

GIT_ROOT="$HOME/rndCRM/crm-of-r-d"
REPO_DIR="$GIT_ROOT/crm-agencyos"
FRONTEND_TARGET="/var/www/rndCRM/frontend"
BACKEND_PORT=5000

# This script pulls a fresh copy of itself from git. If we kept running
# after that, bash would finish executing the stale in-memory version
# instead of picking up the change. So: pull, then re-exec the file from
# disk (now updated) and let the fresh copy do the actual deploy.
if [[ "${RNDCRM_DEPLOY_REEXEC:-}" != "1" ]]; then
  cd "$GIT_ROOT"
  echo "Pulling latest main"
  git pull origin main
  export RNDCRM_DEPLOY_REEXEC=1
  exec bash "$0" "$@"
fi

BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'; CYAN='\033[36m'

STEP=0
DEPLOY_START=$(date +%s)

step() {
  STEP=$((STEP + 1))
  echo -e "\n${BOLD}${CYAN}▶ [$STEP] $*${RESET}"
}

HEALTHY=1

ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
warn() { echo -e "  ${YELLOW}!${RESET} $*"; }
fail() { echo -e "  ${RED}✗${RESET} $*"; HEALTHY=0; }

on_error() {
  local exit_code=$?
  echo -e "\n${BOLD}${RED}✗ Deploy failed (step $STEP, exit $exit_code)${RESET}"
  exit "$exit_code"
}
trap on_error ERR

echo -e "${BOLD}rndCRM deploy — $(date '+%Y-%m-%d %H:%M:%S %Z')${RESET}"

step "Latest commit"
cd "$REPO_DIR"
ok "$(git log -1 --format='%h %s')"

step "Installing frontend dependencies"
npm install --no-fund --no-audit >/tmp/rndcrm-deploy-npm-frontend.log 2>&1
ok "done"

step "Building frontend"
npm run build >/tmp/rndcrm-deploy-build.log 2>&1
ok "built to dist/"

step "Deploying frontend build"
cp -r dist/* "$FRONTEND_TARGET"/
ok "copied to $FRONTEND_TARGET"

step "Reloading nginx"
sudo systemctl reload nginx
ok "reloaded"

step "Installing backend dependencies"
cd backend
npm install --no-fund --no-audit >/tmp/rndcrm-deploy-npm-backend.log 2>&1
ok "done"

step "Restarting backend services via PM2"
pm2 restart rndCRM-backend
pm2 restart email-worker
pm2 save >/dev/null
ok "restarted"

check_pm2() {
  local name="$1" status
  status=$(pm2 jlist | node -e "
    const procs = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const p = procs.find(x => x.name === process.argv[1]);
    console.log(p ? p.pm2_env.status : 'missing');
  " "$name")
  if [[ "$status" == "online" ]]; then
    ok "$name: online"
  else
    fail "$name: $status"
  fi
}

step "Health check"
sleep 2

check_pm2 "rndCRM-backend"
check_pm2 "email-worker"

if systemctl is-active --quiet nginx; then
  ok "nginx: active"
else
  fail "nginx: not active"
fi

HEALTH_RESPONSE=$(curl -fsS -m 5 "http://localhost:${BACKEND_PORT}/api/health" 2>/dev/null || echo "")
if [[ -n "$HEALTH_RESPONSE" ]]; then
  ok "backend /api/health: $HEALTH_RESPONSE"
else
  fail "backend /api/health: no response on port $BACKEND_PORT"
fi

DEPLOY_END=$(date +%s)
ELAPSED=$(( DEPLOY_END - DEPLOY_START ))

if [[ "$HEALTHY" -eq 1 ]]; then
  echo -e "\n${BOLD}${GREEN}✓ Deploy complete${RESET} ${DIM}(${ELAPSED}s)${RESET}\n"
  pm2 list
else
  echo -e "\n${BOLD}${RED}✗ Deploy finished but health check failed${RESET} ${DIM}(${ELAPSED}s)${RESET}\n"
  pm2 list
  exit 1
fi
