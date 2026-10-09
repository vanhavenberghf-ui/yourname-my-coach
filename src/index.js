const { Client, GatewayIntentBits, Partials, Events, Collection, ActivityType, EmbedBuilder } = require('discord.js');
const config = require('./config');
const commands = require('./commands');
const automod = require('./automod');
const { runPlaytest, getGameStats } = require('./roblox');
const { buildEmbeds } = require('./report');
const { findChannel } = require('./util');

if (!config.token) {
  console.error('DISCORD_TOKEN missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // privileged: enable "Server Members Intent"
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged: enable "Message Content Intent"
  ],
  partials: [Partials.GuildMember],
});

client.commands = new Collection(commands.map((c) => [c.data.name, c]));

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  refreshPresence();
  setInterval(refreshPresence, 5 * 60_000);

  if (config.autoTestIntervalMin > 0) {
    console.log(`Auto playtest every ${config.autoTestIntervalMin} min`);
    setInterval(autoPlaytest, config.autoTestIntervalMin * 60_000);
  }
});

// Status shows live player count: "Watching 42 players in <game>"
async function refreshPresence() {
  try {
    const g = await getGameStats();
    client.user.setActivity(`${g.playing} players in ${g.name}`, { type: ActivityType.Watching });
  } catch {
    client.user.setActivity('/help', { type: ActivityType.Listening });
  }
}

async function autoPlaytest() {
  const guild = client.guilds.cache.get(config.guildId);
  const channel = guild && findChannel(guild, 'botReports');
  if (!channel) return;
  try {
    const report = await runPlaytest({ intensity: 'normal' });
    await channel.send({ embeds: buildEmbeds(report, 'Scheduled playtest') });
  } catch (err) {
    await channel.send(`❌ Scheduled playtest failed: ${err.message}`);
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`/${interaction.commandName} failed:`, err);
    const reply = { content: `❌ Something went wrong: ${err.message}`, ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
  }
});

client.on(Events.MessageCreate, (message) => automod.handle(message).catch(console.error));

// Welcome + auto-give the Player role
client.on(Events.GuildMemberAdd, async (member) => {
  const role = member.guild.roles.cache.find((r) => r.name === config.roles.player);
  if (role) await member.roles.add(role).catch(() => {});
  const general = findChannel(member.guild, 'general');
  const rules = findChannel(member.guild, 'rules');
  if (general) {
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setDescription(`👋 Welcome ${member}! Read ${rules ?? '#rules'} and have fun.${config.roblox.placeId ? `\n[▶ Play the game](https://www.roblox.com/games/${config.roblox.placeId})` : ''}`)
      .setThumbnail(member.user.displayAvatarURL());
    await general.send({ embeds: [embed] }).catch(() => {});
  }
});

process.on('unhandledRejection', (err) => console.error('Unhandled:', err));
client.login(config.token);
