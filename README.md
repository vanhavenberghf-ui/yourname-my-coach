# Roblox Game Discord Bot

A Discord bot for your Roblox game. It can:

- **Build your Discord server** with `/setup`: roles (Developer, Moderator, Tester, Player, Muted), channels for info, community, feedback, staff and voice, permissions, and a rules post.
- **Stress-test the live game** with `/playtest`: it starts a real Roblox server of your place, tries to break it, and posts a graded report (A–F) with:
  - server FPS when idle, under load, and after cleanup
  - memory growth (possible leaks)
  - script errors that happened during the test
  - fuzzing: calls your ModuleScript functions with junk input (NaN, huge numbers, 10k-character strings, wrong types) and reports crashes and hangs
  - a remote security audit that flags RemoteEvents/RemoteFunctions with names like `GiveMoney` or `AddCoins` that exploiters target
  - map checks: no SpawnLocation, too many parts or unanchored parts, StreamingEnabled
  - optional scheduled tests posted to `#bot-reports`
- **Moderate**: `/mod warn|timeout|kick|ban|purge|warnings`, automatic escalation (3 warnings → 1h timeout, 5 → kick), and AutoMod for invite links, "free robux" scams, spam, mass mentions, caps and custom blocked words. Everything is logged to `#mod-log`.
- **Post updates**: `/update` opens a form (version, added, fixed, changed, optional image) and posts nicely formatted patch notes to `#game-updates`, pinging `@Player`.
- **Extras**: `/gamestats` (live players, visits, rating), `/bugreport` (a form that opens a thread per bug), welcome messages, auto Player role, and a bot status showing the live player count.

## 1. Create the Discord server and bot

1. In Discord, click **+ → Create My Own** to make an empty server. A bot can't create the server for you, but `/setup` fills it in.
2. Go to https://discord.com/developers/applications → **New Application**.
3. **Bot** tab → **Reset Token** → copy it (this is `DISCORD_TOKEN`).
   On the same page, turn on **Server Members Intent** and **Message Content Intent**.
4. **General Information** → copy the **Application ID** (this is `DISCORD_CLIENT_ID`).
5. **OAuth2 → URL Generator**: tick `bot` and `applications.commands`, then under permissions tick **Administrator**. Open the URL and add the bot to your server.
6. In Discord: Settings → Advanced → turn on **Developer Mode**. Right-click your server → **Copy Server ID** (this is `DISCORD_GUILD_ID`).

## 2. Roblox API key (for `/playtest`)

1. https://create.roblox.com/dashboard/credentials → **Create API Key**.
2. Add the **luau-execution-sessions** API system, select your experience, and give it **write** access.
3. Copy the key (`ROBLOX_API_KEY`).
4. **Universe ID**: open your game on create.roblox.com; the number in the URL is the universe ID.
   **Place ID**: the number in the game's roblox.com URL.

`/gamestats` only needs the universe ID.

## 3. Run it on your PC (from GitHub)

You need [Node.js 18+](https://nodejs.org) and [Git](https://git-scm.com).

```bash
git clone https://github.com/vanhavenberghf-ui/yourname-my-coach.git
cd yourname-my-coach
copy .env.example .env      # on Mac/Linux: cp .env.example .env
```

Open `.env` and fill in your values. Then:

- **Windows**: double-click `start.bat`
- **Mac/Linux**: `./start.sh`

Each time it starts, it pulls the latest code from GitHub, installs packages, registers the slash commands, and runs the bot. If the bot crashes, it restarts on its own. To start the bot when the PC boots, put a shortcut to `start.bat` in `shell:startup` (press Win+R and type `shell:startup`).

Then in Discord, run **`/setup`** once. Afterwards, drag the bot's role **above** the Muted/Player/Tester roles in Server Settings → Roles.

## How the game testing works

`/playtest` sends [`roblox/StressTest.luau`](roblox/StressTest.luau) to Roblox's Open Cloud **Luau Execution** API. Roblox starts a headless server of your **published** place and runs the script there. The script returns a JSON report, and the bot turns it into a score and feedback.

Things to know:
- It tests the **server side** of the game. Real players aren't simulated, so client UI bugs and LocalScripts aren't covered.
- It runs against your **live** universe, so it uses the same DataStores. Fuzzing skips functions and modules with names containing `save`, `data`, `store`, `purchase`, `ban`, `give`, `reset` and similar. If your game uses other names for risky functions, add them to `UNSAFE_NAME_PATTERNS` at the top of the script.
- Intensity: `light` (250 parts, 1 fuzz round), `normal` (750, 3), `brutal` (2500, 8).
- You can add your own checks to `StressTest.luau`. Anything added with `issue("high" | "medium" | "low", title, detail)` shows up in the report.

## Free 24/7 hosting on Oracle Cloud

1. Sign up at https://www.oracle.com/cloud/free/ (pick a home region near you; the card is only used for verification).
2. **Create a VM instance**: Compute → Instances → Create. For the image, pick **Ubuntu 24.04**. For the shape, pick **Ampere VM.Standard.A1.Flex** (1 OCPU and 6 GB are plenty; if Ampere is "out of capacity", use **VM.Standard.E2.1.Micro**). Click **Save private key** before you create it.
3. Once it's running, copy its **Public IP**, open a terminal on your PC and connect:
   ```bash
   ssh -i path/to/the-key.key ubuntu@YOUR_PUBLIC_IP
   ```
   (Windows 10/11 has `ssh` built in. Use PowerShell.)
4. Paste this one command. It asks for your keys and does everything else:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/vanhavenberghf-ui/yourname-my-coach/main/deploy/oracle-setup.sh | bash
   ```

The bot now runs 24/7, restarts if it crashes, and installs new code from GitHub every 10 minutes. You don't need to open any ports, because the bot connects out to Discord.

- Logs: `journalctl -u discord-bot -f`
- Change keys: `nano ~/discord-bot/.env` then `sudo systemctl restart discord-bot`
- Stop: `sudo systemctl stop discord-bot`

Turn off `start.bat` on your PC once Oracle is running, or you'll have two copies of the bot answering.

## Project layout

```
src/index.js            bot startup, events, welcome, scheduled tests
src/automod.js          automatic moderation
src/roblox.js           Roblox Open Cloud + game stats
src/report.js           scoring and Discord embeds for test reports
src/commands/*.js       slash commands (setup, mod, update, playtest, gamestats, bugreport, help)
roblox/StressTest.luau  the script that tries to break your game
```
