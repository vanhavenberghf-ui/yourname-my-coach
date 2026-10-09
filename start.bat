@echo off
REM Double-click to update from GitHub and run the bot on this PC.
cd /d "%~dp0"
git pull
call npm install --omit=dev
call npm run deploy
:loop
node src/index.js
echo Bot stopped - restarting in 5 seconds (close this window to quit)...
timeout /t 5 >nul
goto loop
