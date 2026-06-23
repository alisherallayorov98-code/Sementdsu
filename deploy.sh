#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# SEMENT — serverda avtomatik deploy skripti.
# GitHub Actions (push'da) yoki qo'lda chaqiriladi:  bash /root/Sementdsu/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
REPO="/root/Sementdsu"
WWW="/var/www/sement"

echo ">>> [1/5] git pull"
cd "$REPO"
git pull origin master

echo ">>> [2/5] backend paketlar"
cd "$REPO/backend"
npm install --omit=dev

echo ">>> [3/5] backend restart (pm2)"
pm2 restart sement-api

echo ">>> [4/5] frontend build"
cd "$REPO/dashboard"
npm install
npm run build

echo ">>> [5/5] dist -> $WWW (eski fayllarni tozalab)"
mkdir -p "$WWW"
rm -rf "$WWW"/*   # eski assets/*.js to'planib qolmasligi uchun
cp -r "$REPO/dashboard/dist/"* "$WWW/"

echo ">>> DEPLOY TUGADI: $(date)"
