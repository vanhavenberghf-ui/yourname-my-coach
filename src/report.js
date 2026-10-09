// Turns the StressTest.luau JSON report into a score + Discord embeds.
const { EmbedBuilder } = require('discord.js');

const PENALTY = { high: 15, medium: 7, low: 2 };
const ICON = { high: '🔴', medium: '🟠', low: '🟡' };

function score(report) {
  if (report.crashed) return 0;
  const lost = report.issues.reduce((sum, i) => sum + (PENALTY[i.severity] ?? 0), 0);
  return Math.max(0, 100 - lost);
}

function grade(s) {
  if (s >= 90) return ['A', 0x2ecc71, 'Rock solid. Ship it!'];
  if (s >= 75) return ['B', 0x27ae60, 'Good shape, a few things to polish.'];
  if (s >= 60) return ['C', 0xf1c40f, 'Playable, but players will notice some problems.'];
  if (s >= 40) return ['D', 0xe67e22, 'Several real bugs/perf problems. Fix before the next update.'];
  return ['F', 0xe74c3c, 'The bot broke it. Needs attention now.'];
}

function buildEmbeds(report, title = 'Automated playtest') {
  if (report.crashed) {
    return [
      new EmbedBuilder()
        .setTitle(`💥 ${title}: server crashed / test failed`)
        .setColor(0xe74c3c)
        .setDescription(`\`\`\`${String(report.error).slice(0, 1800)}\`\`\``)
        .setTimestamp(),
    ];
  }

  const s = score(report);
  const [letter, color, verdict] = grade(s);
  const st = report.stats;

  const summary = new EmbedBuilder()
    .setTitle(`🧪 ${title} — Grade ${letter} (${s}/100)`)
    .setColor(color)
    .setDescription(`${verdict}\nIntensity: **${report.intensity}**`)
    .addFields(
      {
        name: 'Server performance',
        value: [
          `Idle: **${st.baseline.fps} FPS** (worst frame ${st.baseline.worstMs} ms)`,
          `Under load (+${st.stress.parts} parts): **${st.stress.fps} FPS** (worst ${st.stress.worstMs} ms)`,
          `After cleanup: **${st.after.fps} FPS**`,
        ].join('\n'),
      },
      {
        name: 'Memory',
        value: `${st.memoryStartMb} MB → ${st.memoryEndMb} MB (${st.memoryGrowthMb >= 0 ? '+' : ''}${st.memoryGrowthMb} MB)`,
        inline: true,
      },
      { name: 'World', value: `${st.parts} parts, ${st.unanchoredParts} unanchored\n${st.instanceCount} instances`, inline: true },
      {
        name: 'Break attempts',
        value: [
          `${st.functionsFuzzed} junk-input calls → **${st.fuzzCrashes}** crashes, **${st.hangs}** hangs`,
          `${st.moduleRequireFails} modules fail to load, ${st.remotes} remotes audited`,
          `${report.errors.length} script errors caught`,
        ].join('\n'),
      },
    )
    .setTimestamp();

  const embeds = [summary];

  if (report.issues.length) {
    const order = { high: 0, medium: 1, low: 2 };
    const lines = [...report.issues]
      .sort((a, b) => order[a.severity] - order[b.severity])
      .map((i) => `${ICON[i.severity]} **${i.title}**\n${i.detail}`);
    let text = '';
    for (const line of lines) {
      if (text.length + line.length > 3900) {
        text += `\n…and ${lines.length - lines.indexOf(line)} more`;
        break;
      }
      text += `${line}\n\n`;
    }
    embeds.push(new EmbedBuilder().setTitle('Issues found').setColor(color).setDescription(text));
  } else {
    embeds.push(new EmbedBuilder().setTitle('No issues found 🎉').setColor(color));
  }

  if (report.errors.length) {
    const text = report.errors
      .slice(0, 8)
      .map((e) => `**${e.script}**\n\`${e.message.slice(0, 200)}\``)
      .join('\n');
    embeds.push(new EmbedBuilder().setTitle('Script errors').setColor(0xe74c3c).setDescription(text.slice(0, 4000)));
  }

  return embeds;
}

module.exports = { buildEmbeds, score };
