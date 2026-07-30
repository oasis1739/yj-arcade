#!/usr/bin/env bash
# YJ 아케이드 배포 — 테스트 통과 시에만 빌드해서 gh-pages 브랜치로 올린다.
# 사용법: npm run deploy
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ 테스트"
npm test

echo "▶ 빌드"
npm run build

echo "▶ gh-pages 푸시"
cd dist
git init -q
git checkout -qb gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" \
    -c user.email="$(git -C .. config user.email)" \
    commit -qm "deploy: $(cd .. && git rev-parse --short HEAD)"
git push -qf "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
echo "✅ 배포 완료"
