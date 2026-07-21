#!/usr/bin/env bash
#
# Deploy script for rndCRM (crm-agencyos).
# Runs ON THE VM. Triggered remotely via SSH from the GitHub Actions
# workflow at .github/workflows/deploy.yml — see DEPLOY.md for setup.
set -euo pipefail

REPO_DIR="$HOME/rndCRM/crm-of-r-d/crm-agencyos"
FRONTEND_TARGET="/var/www/rndCRM/frontend"

log() { echo -e "\n==> $*"; }

cd "$REPO_DIR"

log "Pulling latest main"
git pull origin main

log "Installing frontend dependencies"
npm install

log "Building frontend"
npm run build

log "Deploying frontend build"
cp -rv dist/* "$FRONTEND_TARGET"/

log "Reloading nginx"
sudo systemctl reload nginx

log "Installing backend dependencies"
cd backend
npm install

log "Restarting backend services via PM2"
pm2 restart rndCRM-backend
pm2 restart email-worker
pm2 save

log "Current PM2 process list"
pm2 list

log "Deploy complete"
