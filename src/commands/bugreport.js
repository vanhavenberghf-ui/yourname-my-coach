// Lets players file structured bug reports into #bug-reports (as a thread per bug).
const {
  SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder,
} = require('discord.js');
const { findChannel } = require('../util');

const row = (id, label, style, required = true) =>
  new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required));

module.exports = {
  data: new SlashCommandBuilder().setName('bugreport').setDescription('Report a bug in the game'),

  async execute(interaction) {
    await interaction.showModal(
      new ModalBuilder().setCustomId('bug-modal').setTitle('Bug report').addComponents(
        row('what', 'What went wrong?', TextInputStyle.Short),
        row('steps', 'Steps to reproduce', TextInputStyle.Paragraph),
        row('device', 'Device (PC / mobile / console / Xbox)', TextInputStyle.Short, false),
      ),
    );
    const submit = await interaction.awaitModalSubmit({ time: 15 * 60_000, filter: (i) => i.user.id === interaction.user.id }).catch(() => null);
    if (!submit) return;

    const channel = findChannel(interaction.guild, 'bugReports');
    if (!channel) return submit.reply({ content: 'No bug report channel - ask an admin to run /setup.', ephemeral: true });

    const what = submit.fields.getTextInputValue('what');
    const embed = new EmbedBuilder()
      .setTitle(`🐛 ${what}`.slice(0, 256))
      .setColor(0xe74c3c)
      .addFields(
        { name: 'Steps', value: submit.fields.getTextInputValue('steps').slice(0, 1024) },
        { name: 'Device', value: submit.fields.getTextInputValue('device') || 'unknown', inline: true },
        { name: 'Reporter', value: `${interaction.user}`, inline: true },
      )
      .setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    await msg.startThread({ name: what.slice(0, 90) }).catch(() => {});
    await submit.reply({ content: `✅ Thanks! Your report: ${msg.url}`, ephemeral: true });
  },
};
