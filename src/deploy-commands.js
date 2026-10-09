// Registers slash commands with Discord. Run once, and again after changing commands.
const { REST, Routes } = require('discord.js');
const config = require('./config');
const commands = require('./commands');

(async () => {
  if (!config.token || !config.clientId || !config.guildId) {
    console.error('Set DISCORD_TOKEN, DISCORD_CLIENT_ID and DISCORD_GUILD_ID in .env first.');
    process.exit(1);
  }
  const rest = new REST().setToken(config.token);
  const body = commands.map((c) => c.data.toJSON());
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });
  console.log(`Registered ${body.length} commands: ${body.map((c) => '/' + c.name).join(', ')}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
