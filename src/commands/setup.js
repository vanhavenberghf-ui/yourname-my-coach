// /setup builds the whole server layout: roles, categories, channels, permissions.
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../config');

const C = config.channels;
const R = config.roles;

const ROLES = [
  { name: R.developer, color: 0xe74c3c, permissions: [PermissionFlagsBits.Administrator], hoist: true },
  {
    name: R.moderator,
    color: 0x3498db,
    hoist: true,
    permissions: [
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
    ],
  },
  { name: R.tester, color: 0x9b59b6, permissions: [], hoist: true },
  { name: R.player, color: 0x2ecc71, permissions: [] },
  { name: R.muted, color: 0x7f8c8d, permissions: [] },
];

// readOnly: only staff can post. staffOnly: hidden from everyone else.
const LAYOUT = [
  { category: '📌 INFO', channels: [
    { name: C.rules, readOnly: true, topic: 'Server rules - read before chatting' },
    { name: C.announcements, readOnly: true, topic: 'Big news about the game' },
    { name: C.updates, readOnly: true, topic: 'Patch notes & game updates (posted by the bot)' },
  ] },
  { category: '💬 COMMUNITY', channels: [
    { name: C.general, topic: 'Talk about anything' },
    { name: 'screenshots', topic: 'Show off your best moments' },
    { name: 'trading', topic: 'In-game trades. No scams.' },
  ] },
  { category: '🛠️ FEEDBACK', channels: [
    { name: C.bugReports, topic: 'Found a bug? Describe it + steps to reproduce' },
    { name: C.suggestions, topic: 'Ideas for the game' },
  ] },
  { category: '🔒 STAFF', staffOnly: true, channels: [
    { name: C.botReports, topic: 'Automated playtest results from the bot' },
    { name: C.modLog, topic: 'Moderation log' },
    { name: 'staff-chat' },
  ] },
  { category: '🔊 VOICE', channels: [
    { name: 'Lounge', voice: true },
    { name: 'Playing Together', voice: true },
  ] },
];

const RULES = `**📜 Server Rules**
1. Be respectful. No harassment, hate speech or discrimination.
2. No spam, flooding, or excessive caps/emoji.
3. No advertising or Discord invite links.
4. No NSFW content.
5. No scamming, exploiting, or sharing cheats for the game.
6. Report bugs in #${C.bugReports} - don't abuse them.
7. Follow Discord ToS and Roblox Community Standards.

Breaking rules → warning → timeout → kick → ban. AutoMod is active.`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create the roles, categories and channels for the game server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const created = [];

    const roles = {};
    for (const def of ROLES) {
      let role = guild.roles.cache.find((r) => r.name === def.name);
      if (!role) {
        role = await guild.roles.create({ ...def, reason: 'Server setup' });
        created.push(`role @${def.name}`);
      }
      roles[def.name] = role;
    }

    const everyone = guild.roles.everyone;
    const staff = [roles[R.developer], roles[R.moderator]];
    const muted = roles[R.muted];

    for (const group of LAYOUT) {
      const catOverwrites = [{ id: muted.id, deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.Speak, PermissionFlagsBits.AddReactions] }];
      if (group.staffOnly) {
        catOverwrites.push({ id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
        staff.forEach((r) => catOverwrites.push({ id: r.id, allow: [PermissionFlagsBits.ViewChannel] }));
        catOverwrites.push({ id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
      }

      let category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === group.category);
      if (!category) {
        category = await guild.channels.create({
          name: group.category,
          type: ChannelType.GuildCategory,
          permissionOverwrites: catOverwrites,
        });
        created.push(`category ${group.category}`);
      }

      for (const ch of group.channels) {
        if (guild.channels.cache.find((c) => c.name === ch.name.toLowerCase().replace(/ /g, '-') || c.name === ch.name)) continue;
        const overwrites = [...catOverwrites];
        if (ch.readOnly) {
          overwrites.push({ id: everyone.id, deny: [PermissionFlagsBits.SendMessages] });
          staff.forEach((r) => overwrites.push({ id: r.id, allow: [PermissionFlagsBits.SendMessages] }));
          overwrites.push({ id: interaction.client.user.id, allow: [PermissionFlagsBits.SendMessages] });
        }
        const channel = await guild.channels.create({
          name: ch.name,
          type: ch.voice ? ChannelType.GuildVoice : ChannelType.GuildText,
          parent: category.id,
          topic: ch.topic,
          permissionOverwrites: overwrites,
        });
        created.push(`#${ch.name}`);
        if (ch.name === C.rules) await channel.send(RULES);
      }
    }

    await interaction.editReply(
      created.length
        ? `✅ Server set up! Created:\n${created.map((c) => `• ${c}`).join('\n')}\n\nTip: drag the bot's role **above** Muted/Player/Tester so it can manage them.`
        : '✅ Everything already exists - nothing to do.',
    );
  },
};
