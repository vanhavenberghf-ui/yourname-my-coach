const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGameStats } = require('../roblox');

const n = (x) => Number(x ?? 0).toLocaleString('en-US');

module.exports = {
  data: new SlashCommandBuilder().setName('gamestats').setDescription('Live stats for the Roblox game'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const g = await getGameStats();
      const total = g.likes + g.dislikes;
      const rating = total ? Math.round((g.likes / total) * 100) : 0;
      const embed = new EmbedBuilder()
        .setTitle(`🎮 ${g.name}`)
        .setURL(g.url)
        .setColor(0x00a2ff)
        .addFields(
          { name: 'Playing now', value: n(g.playing), inline: true },
          { name: 'Visits', value: n(g.visits), inline: true },
          { name: 'Favorites', value: n(g.favorites), inline: true },
          { name: 'Rating', value: `👍 ${rating}% (${n(g.likes)} / ${n(g.dislikes)})`, inline: true },
          { name: 'Server size', value: `${g.maxPlayers}`, inline: true },
          { name: 'Last updated', value: `<t:${Math.floor(new Date(g.updated) / 1000)}:R>`, inline: true },
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply(`❌ ${err.message}`);
    }
  },
};
