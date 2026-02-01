#!/usr/bin/env bash
set -e

REMOTE="${1:-origin}"
BRANCH="${2:-main}"

echo "== RAULI Deploy =="
echo "Remote: $REMOTE  Branch: $BRANCH"

git status --short

echo "Haciendo pull..."
git pull "$REMOTE" "$BRANCH"

echo "Haciendo push..."
git push "$REMOTE" "$BRANCH"

echo "Listo. Vercel/Render desplegaran automaticamente si estan conectados al repo."
