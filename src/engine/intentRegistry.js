const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const registry = new Map();

const intentsDir = path.join(__dirname, 'intents');

if (fs.existsSync(intentsDir)) {
  for (const file of fs.readdirSync(intentsDir)) {
    if (file.endsWith('.js')) {
      const intent = require(path.join(intentsDir, file));
      if (intent.name && intent.execute) {
        registry.set(intent.name, intent);
        logger.debug(`Loaded intent: ${intent.name}`);
      }
    }
  }
}

module.exports = registry;
