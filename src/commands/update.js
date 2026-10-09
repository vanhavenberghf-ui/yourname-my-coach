// /update opens a form; the result is posted as a nice embed in #game-updates.
const {
  SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder,
  TextInputStyle, ActionRowBuilder, EmbedBuilder,
} = require('discord.js');
const { findChannel } = require('../util');
const config = require('../config');

const field = (id, label, style, required = true) =>
  new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required),
  );

module.exports = {
  data: new SlashCommandBuilder()
    .setName('update')
    .setDescription('Post a game update / patch notes')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((o) => o.setName('ping').setDescription('Ping @Player role (default: yes)'))
    .addAttachmentOption((o) => o.setName('image').setDescription('Optional screenshot / thumbnail')),

  async execute(interaction) {
    const ping = interaction.options.getBoolean('ping') ?? true;
    const image = interaction.options.getAttachment('image');

    const modal = new ModalBuilder()
      .setCustomId('update-modal')
      .setTitle('New game update')
      .addComponents(
        field('version', 'Version (e.g. v1.4.0)', TextInputStyle.Short),
        field('title', 'Title', TextInputStyle.Short),
        field('added', 'Added (one per line)', TextInputStyle.Paragraph, false),
        field('fixed', 'Fixed (one per line)', TextInputStyle.Paragraph, false),
        field('changed', 'Changed (one per line)', TextInputStyle.Paragraph, false),
      );
    await interaction.showModal(modal);

    const submit = await interaction.awaitModalSubmit({ time: 15 * 60_000, filter: (i) => i.user.id === interaction.user.id }).catch(() => null);
    if (!submit) return;

    const get = (id) => submit.fields.getTextInputValue(id).trim();
    const bullets = (txt) => txt.split('\n').filter(Boolean).map((l) => `• ${l.replace(/^[-•*]\s*/, '')}`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`🚀 ${get('version')} — ${get('title')}`)
      .setColor(0x5865f2)
      .setTimestamp()
      .setFooter({ text: `Posted by ${interaction.user.username}` });
    if (get('added')) embed.addFields({ name: '✨ Added', value: bullets(get('added')).slice(0, 1024) });
    if (get('fixed')) embed.addFields({ name: '🐛 Fixed', value: bullets(get('fixed')).slice(0, 1024) });
    if (get('changed')) embed.addFields({ name: '🔧 Changed', value: bullets(get('changed')).slice(0, 1024) });
    if (config.roblox.placeId) embed.setURL(`https://www.roblox.com/games/${config.roblox.placeId}`);
    if (image) embed.setImage(image.url);

    const channel = findChannel(interaction.guild, 'updates');
    if (!channel) return submit.reply({ content: `❌ No #${config.channels.updates} channel. Run /setup first.`, ephemeral: true });

    const role = interaction.guild.roles.cache.find((r) => r.name === config.roles.player);
    const msg = await channel.send({ content: ping && role ? `${role}` : undefined, embeds: [embed] });
    await msg.react('🔥').catch(() => {});
    await submit.reply({ content: `✅ Posted in ${channel}: ${msg.url}`, ephemeral: true });
  },
};
