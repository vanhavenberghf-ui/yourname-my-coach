// Tiny JSON-file store for warnings so they survive restarts.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'warnings.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function add(guildId, userId, entry) {
  const data = load();
  const key = `${guildId}:${userId}`;
  data[key] = [...(data[key] ?? []), { ...entry, at: new Date().toISOString() }];
  save(data);
  return data[key];
}

function list(guildId, userId) {
  return load()[`${guildId}:${userId}`] ?? [];
}

function clear(guildId, userId) {
  const data = load();
  delete data[`${guildId}:${userId}`];
  save(data);
}

module.exports = { add, list, clear };
