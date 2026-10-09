const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const warnings = require('../warnings');
const { modLog } = require('../util');

const userOpt = (o) => o.setName('user').setDescription('Member').setRequired(true);
const reasonOpt = (o) => o.setName('reason').setDescription('Reason');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderation tools')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((s) => s.setName('warn').setDescription('Warn a member').addUserOption(userOpt).addStringOption(reasonOpt))
    .addSubcommand((s) => s.setName('warnings').setDescription('Show warnings').addUserOption(userOpt))
    .addSubcommand((s) => s.setName('clearwarnings').setDescription('Clear warnings').addUserOption(userOpt))
    .addSubcommand((s) =>
      s.setName('timeout').setDescription('Timeout a member').addUserOption(userOpt)
        .addIntegerOption((o) => o.setName('minutes').setDescription('Length (default 10)').setMinValue(1).setMaxValue(40320))
        .addStringOption(reasonOpt))
    .addSubcommand((s) => s.setName('untimeout').setDescription('Remove a timeout').addUserOption(userOpt))
    .addSubcommand((s) => s.setName('kick').setDescription('Kick a member').addUserOption(userOpt).addStringOption(reasonOpt))
    .addSubcommand((s) =>
      s.setName('ban').setDescription('Ban a member').addUserOption(userOpt).addStringOption(reasonOpt)
        .addIntegerOption((o) => o.setName('delete_days').setDescription('Delete their messages from last N days').setMinValue(0).setMaxValue(7)))
    .addSubcommand((s) =>
      s.setName('purge').setDescription('Bulk delete messages in this channel')
        .addIntegerOption((o) => o.setName('amount').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') ?? 'No reason given';
    const member = user ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;
    const me = interaction.member;
    const log = (action, color) => modLog(interaction.guild, { action, target: user, moderator: me.user, reason, color });

    const outranks = () =>
      member && me.roles.highest.comparePositionTo(member.roles.highest) > 0 && member.id !== interaction.guild.ownerId;

    if (['timeout', 'kick', 'ban', 'warn'].includes(sub) && member && !outranks()) {
      return interaction.reply({ content: "❌ You can't moderate someone with an equal or higher role.", ephemeral: true });
    }

    switch (sub) {
      case 'warn': {
        const list = warnings.add(interaction.guildId, user.id, { reason, by: me.id });
        await user.send(`⚠️ You were warned in **${interaction.guild.name}**: ${reason}`).catch(() => {});
        await log(`Warn (#${list.length})`, 0xf1c40f);
        // Escalate automatically on repeated warnings.
        if (member && list.length === 3) await member.timeout(60 * 60_000, '3 warnings').catch(() => {});
        if (member && list.length >= 5) await member.kick('5 warnings').catch(() => {});
        return interaction.reply(`⚠️ Warned ${user} (${list.length} total). ${list.length === 3 ? 'Auto-timeout 1h.' : list.length >= 5 ? 'Auto-kicked.' : ''}`);
      }
      case 'warnings': {
        const list = warnings.list(interaction.guildId, user.id);
        const text = list.length
          ? list.map((w, i) => `${i + 1}. ${w.reason} — <@${w.by}> <t:${Math.floor(new Date(w.at) / 1000)}:R>`).join('\n')
          : 'No warnings.';
        return interaction.reply({ content: `**Warnings for ${user.tag}**\n${text}`, ephemeral: true });
      }
      case 'clearwarnings':
        warnings.clear(interaction.guildId, user.id);
        await log('Warnings cleared', 0x2ecc71);
        return interaction.reply({ content: `✅ Cleared warnings for ${user}.`, ephemeral: true });
      case 'timeout': {
        if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });
        const minutes = interaction.options.getInteger('minutes') ?? 10;
        await member.timeout(minutes * 60_000, reason);
        await log(`Timeout (${minutes} min)`);
        return interaction.reply(`🔇 ${user} timed out for ${minutes} min.`);
      }
      case 'untimeout':
        if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });
        await member.timeout(null);
        await log('Timeout removed', 0x2ecc71);
        return interaction.reply(`🔊 Removed timeout for ${user}.`);
      case 'kick':
        if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });
        await user.send(`👢 You were kicked from **${interaction.guild.name}**: ${reason}`).catch(() => {});
        await member.kick(reason);
        await log('Kick', 0xe67e22);
        return interaction.reply(`👢 Kicked ${user.tag}.`);
      case 'ban': {
        const days = interaction.options.getInteger('delete_days') ?? 0;
        await user.send(`🔨 You were banned from **${interaction.guild.name}**: ${reason}`).catch(() => {});
        await interaction.guild.members.ban(user.id, { reason, deleteMessageSeconds: days * 86400 });
        await log('Ban', 0xe74c3c);
        return interaction.reply(`🔨 Banned ${user.tag}.`);
      }
      case 'purge': {
        const amount = interaction.options.getInteger('amount');
        const deleted = await interaction.channel.bulkDelete(amount, true);
        await modLog(interaction.guild, { action: `Purge ${deleted.size} msgs in #${interaction.channel.name}`, moderator: me.user, reason: '-' });
        return interaction.reply({ content: `🧹 Deleted ${deleted.size} messages.`, ephemeral: true });
      }
    }
  },
};
