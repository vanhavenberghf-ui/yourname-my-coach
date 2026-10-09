#!/usr/bin/env bash
# One-command install for an Oracle Cloud (Ubuntu) server.
#   curl -fsSL https://raw.githubusercontent.com/vanhavenberghf-ui/yourname-my-coach/main/deploy/oracle-setup.sh | bash
# Installs Node.js, clones the bot, asks for your keys, runs it 24/7 as a service,
# and pulls new code from GitHub every 10 minutes (auto-restarting when it changes).
set -euo pipefail

REPO="https://github.com/vanhavenberghf-ui/yourname-my-coach.git"
BRANCH="${BRANCH:-main}"
DIR="$HOME/discord-bot"

echo "==> Installing Node.js and git"
sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates
if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Getting the bot code"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH" && git -C "$DIR" checkout "$BRANCH" && git -C "$DIR" pull
else
  git clone -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"
npm install --omit=dev

if [ ! -f .env ]; then
  echo "==> Enter your keys (see README). Leave Roblox ones empty to skip."
  ask() { read -r -p "$1: " v </dev/tty; echo "$2=$v" >> .env; }
  ask "Discord bot token" DISCORD_TOKEN
  ask "Discord application ID" DISCORD_CLIENT_ID
  ask "Discord server ID" DISCORD_GUILD_ID
  ask "Roblox API key" ROBLOX_API_KEY
  ask "Roblox universe ID" ROBLOX_UNIVERSE_ID
  ask "Roblox place ID" ROBLOX_PLACE_ID
  ask "Auto playtest every N minutes (0 = off)" AUTO_TEST_INTERVAL_MIN
  chmod 600 .env
fi

npm run deploy

echo "==> Installing service"
sudo tee /etc/systemd/system/discord-bot.service >/dev/null <<UNIT
[Unit]
Description=Roblox game Discord bot
After=network-online.target
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$DIR
ExecStart=$(command -v node) src/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

cat > "$DIR/deploy/auto-update.sh" <<UPD
#!/usr/bin/env bash
cd "$DIR"
git fetch -q origin "$BRANCH"
if [ "\$(git rev-parse HEAD)" != "\$(git rev-parse origin/$BRANCH)" ]; then
  git reset -q --hard "origin/$BRANCH"
  npm install --omit=dev --silent
  npm run deploy --silent
  sudo systemctl restart discord-bot
fi
UPD
chmod +x "$DIR/deploy/auto-update.sh"
( crontab -l 2>/dev/null | grep -v auto-update.sh; echo "*/10 * * * * $DIR/deploy/auto-update.sh >> $DIR/update.log 2>&1" ) | crontab -

sudo systemctl daemon-reload
sudo systemctl enable --now discord-bot
sleep 3
sudo systemctl --no-pager status discord-bot | head -n 5
echo
echo "✅ Done! The bot runs 24/7 and updates itself from GitHub every 10 minutes."
echo "   Logs:    journalctl -u discord-bot -f"
echo "   Restart: sudo systemctl restart discord-bot"
