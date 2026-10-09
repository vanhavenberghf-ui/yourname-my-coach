const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { runPlaytest } = require('../roblox');
const { buildEmbeds } = require('../report');
const { findChannel } = require('../util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playtest')
    .setDescription('Let the bot stress-test the live game and try to break it')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o.setName('intensity').setDescription('How hard to push the game').addChoices(
        { name: 'light', value: 'light' },
        { name: 'normal', value: 'normal' },
        { name: 'brutal', value: 'brutal' },
      )),

  async execute(interaction) {
    const intensity = interaction.options.getString('intensity') ?? 'normal';
    await interaction.deferReply();
    await interaction.editReply(`🧪 Booting a test server and trying to break the game (**${intensity}**)… this takes 1-3 minutes.`);
    try {
      const report = await runPlaytest({ intensity });
      const embeds = buildEmbeds(report, `Playtest by ${interaction.user.username}`);
      await interaction.editReply({ content: '', embeds });
      const reports = findChannel(interaction.guild, 'botReports');
      if (reports && reports.id !== interaction.channelId) await reports.send({ embeds });
    } catch (err) {
      await interaction.editReply(`❌ Playtest failed: ${err.message}`);
    }
  },
};
