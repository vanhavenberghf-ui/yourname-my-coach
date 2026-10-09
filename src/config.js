require('dotenv').config({ quiet: true });

const env = (name, fallback) => process.env[name] ?? fallback;

module.exports = {
  token: env('DISCORD_TOKEN'),
  clientId: env('DISCORD_CLIENT_ID'),
  guildId: env('DISCORD_GUILD_ID'),
  roblox: {
    apiKey: env('ROBLOX_API_KEY'),
    universeId: env('ROBLOX_UNIVERSE_ID'),
    placeId: env('ROBLOX_PLACE_ID'),
  },
  autoTestIntervalMin: Number(env('AUTO_TEST_INTERVAL_MIN', '0')) || 0,
  blockedWords: env('BLOCKED_WORDS', '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean),

  // Channel names the bot creates with /setup and looks up later.
  channels: {
    rules: 'rules',
    announcements: 'announcements',
    updates: 'game-updates',
    general: 'general',
    bugReports: 'bug-reports',
    suggestions: 'suggestions',
    botReports: 'bot-reports',
    modLog: 'mod-log',
  },
  roles: {
    developer: 'Developer',
    moderator: 'Moderator',
    tester: 'Tester',
    player: 'Player',
    muted: 'Muted',
  },
};
