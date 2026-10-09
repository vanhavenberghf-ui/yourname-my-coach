const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('List bot commands'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Bot commands')
      .setColor(0x5865f2)
      .addFields(
        { name: 'Everyone', value: '`/gamestats` live game stats\n`/bugreport` report a bug\n`/help` this list' },
        { name: 'Staff', value: '`/update` post patch notes\n`/playtest` stress-test the game\n`/mod warn|warnings|clearwarnings|timeout|untimeout|kick|ban|purge`' },
        { name: 'Admin', value: '`/setup` build roles & channels' },
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
