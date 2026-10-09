// Roblox Open Cloud + public web API helpers.
const fs = require('fs');
const path = require('path');
const config = require('./config');

const OPEN_CLOUD = 'https://apis.roblox.com/cloud/v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireConfig() {
  const { apiKey, universeId, placeId } = config.roblox;
  if (!apiKey || !universeId || !placeId) {
    throw new Error('ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID and ROBLOX_PLACE_ID must be set in .env');
  }
  return { apiKey, universeId, placeId };
}

async function cloud(url, apiKey, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'x-api-key': apiKey, 'content-type': 'application/json', ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Roblox API ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/**
 * Runs roblox/StressTest.luau inside a real headless server of the published place
 * (Open Cloud Luau Execution) and returns the parsed JSON report.
 */
async function runPlaytest({ intensity = 'normal', timeoutMs = 5 * 60_000 } = {}) {
  const { apiKey, universeId, placeId } = requireConfig();
  const source = fs.readFileSync(path.join(__dirname, '..', 'roblox', 'StressTest.luau'), 'utf8');
  const script = `local INTENSITY = ${JSON.stringify(intensity)}\n${source}`;

  const task = await cloud(
    `${OPEN_CLOUD}/universes/${universeId}/places/${placeId}/luau-execution-session-tasks`,
    apiKey,
    { method: 'POST', body: JSON.stringify({ script, timeout: '280s' }) },
  );

  const started = Date.now();
  let current = task;
  while (!['COMPLETE', 'FAILED', 'CANCELLED'].includes(current.state)) {
    if (Date.now() - started > timeoutMs) throw new Error('Playtest timed out waiting for Roblox');
    await sleep(3000);
    current = await cloud(`${OPEN_CLOUD}/${task.path}`, apiKey);
  }

  if (current.state !== 'COMPLETE') {
    const msg = current.error?.message ?? current.state;
    return { crashed: true, error: msg };
  }

  const raw = current.output?.results?.[0];
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { crashed: true, error: `Could not parse report: ${String(raw).slice(0, 200)}` };
  }
}

/** Public live stats (players online, visits, likes). No API key needed. */
async function getGameStats() {
  const { universeId } = config.roblox;
  if (!universeId) throw new Error('ROBLOX_UNIVERSE_ID is not set');
  const [games, votes] = await Promise.all([
    fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`).then((r) => r.json()),
    fetch(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`).then((r) => r.json()),
  ]);
  const g = games.data?.[0];
  const v = votes.data?.[0];
  if (!g) throw new Error('Game not found - check ROBLOX_UNIVERSE_ID');
  return {
    name: g.name,
    playing: g.playing,
    visits: g.visits,
    favorites: g.favoritedCount,
    maxPlayers: g.maxPlayers,
    updated: g.updated,
    likes: v?.upVotes ?? 0,
    dislikes: v?.downVotes ?? 0,
    url: `https://www.roblox.com/games/${config.roblox.placeId ?? g.rootPlaceId}`,
  };
}

module.exports = { runPlaytest, getGameStats };
