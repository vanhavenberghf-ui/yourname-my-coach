const { EmbedBuilder } = require('discord.js');
const config = require('./config');

function findChannel(guild, key) {
  const name = config.channels[key] ?? key;
  return guild.channels.cache.find((c) => c.name === name && c.isTextBased());
}

async function modLog(guild, { action, target, moderator, reason, color = 0xe67e22 }) {
  const channel = findChannel(guild, 'modLog');
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle(`🛡️ ${action}`)
    .setColor(color)
    .addFields(
      { name: 'User', value: target ? `${target} (${target.id})` : 'n/a', inline: true },
      { name: 'By', value: moderator ? `${moderator}` : 'AutoMod', inline: true },
      { name: 'Reason', value: reason || 'No reason given' },
    )
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { findChannel, modLog };
