#!/bin/bash
set -u

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

PWCLI="/Users/drl33/.codex/skills/playwright/scripts/playwright_cli.sh"
SESSION="cb-mobile"
BASE="https://creatorbridge.studio"

routes=(
  "/"
  "/find"
  "/projects"
  "/network"
  "/creator/seed-1"
  "/client"
  "/messages"
  "/login"
  "/register"
)

for route in "${routes[@]}"; do
  echo "=== ${route} ==="
  /bin/bash "$PWCLI" --session "$SESSION" goto "${BASE}${route}" >/dev/null
  /bin/bash "$PWCLI" --session "$SESSION" resize 390 844 >/dev/null
  /bin/bash "$PWCLI" --session "$SESSION" eval "JSON.stringify({path: location.pathname, title: document.title, width: window.innerWidth, height: window.innerHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText.slice(0, 220)})"
  /bin/bash "$PWCLI" --session "$SESSION" console error
  /bin/bash "$PWCLI" --session "$SESSION" screenshot
done
