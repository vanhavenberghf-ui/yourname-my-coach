#!/usr/bin/env bash
# Update from GitHub and run the bot on this PC (auto-restarts if it crashes).
cd "$(dirname "$0")"
git pull
npm install --omit=dev
npm run deploy
while true; do
  node src/index.js
  echo "Bot stopped - restarting in 5s (Ctrl+C to quit)"
  sleep 5
done
