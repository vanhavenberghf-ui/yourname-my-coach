// Simple AutoMod: invite links, mass mentions, spam flooding, blocked words.
const { PermissionFlagsBits } = require('discord.js');
const config = require('./config');
const warnings = require('./warnings');
const { modLog } = require('./util');

const INVITE = /(discord\.gg|discord(app)?\.com\/invite)\/\w+/i;
const SCAM = /(free\s*robux|robux\s*generator|nitro\s*free|steamcommunity\.\w+\/gift)/i;
const recent = new Map(); // userId -> timestamps

async function punish(message, reason) {
  await message.delete().catch(() => {});
  const list = warnings.add(message.guild.id, message.author.id, { reason: `AutoMod: ${reason}`, by: message.client.user.id });
  const note = await message.channel.send(`${message.author}, your message was removed: **${reason}**.`).catch(() => null);
  setTimeout(() => note?.delete().catch(() => {}), 8000);
  if (list.length >= 3) await message.member?.timeout(30 * 60_000, 'AutoMod: repeated violations').catch(() => {});
  await modLog(message.guild, { action: `AutoMod (${reason})`, target: message.author, reason: message.content.slice(0, 500) });
}

async function handle(message) {
  if (!message.guild || message.author.bot || !message.member) return;
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return; // staff exempt

  const text = message.content;
  const lower = text.toLowerCase();

  if (INVITE.test(text)) return punish(message, 'invite links are not allowed');
  if (SCAM.test(text)) return punish(message, 'scam link / free robux');
  if (config.blockedWords.some((w) => lower.includes(w))) return punish(message, 'blocked word');
  if (message.mentions.users.size + message.mentions.roles.size >= 5) return punish(message, 'mass mentions');
  if (text.length > 20 && text.replace(/[^A-Z]/g, '').length / text.replace(/[^a-zA-Z]/g, '').length > 0.8) {
    return punish(message, 'excessive caps');
  }

  // 6+ messages in 5 seconds = spam
  const now = Date.now();
  const times = (recent.get(message.author.id) ?? []).filter((t) => now - t < 5000);
  times.push(now);
  recent.set(message.author.id, times);
  if (times.length >= 6) {
    recent.delete(message.author.id);
    await message.member.timeout(5 * 60_000, 'AutoMod: spam').catch(() => {});
    return punish(message, 'spamming');
  }
}

module.exports = { handle };
