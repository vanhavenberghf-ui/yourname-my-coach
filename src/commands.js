const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'commands');
module.exports = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => require(path.join(dir, f)));
