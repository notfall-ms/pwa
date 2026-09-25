const { resolve } = require('node:path');
const { createJiti } = require('jiti');

// resolve absolute path to eslint.config.ts next to this file
const tsConfigPath = resolve(__dirname, 'eslint.config.ts');

// create a Jiti instance for importing the TypeScript ESLint config
const jiti = createJiti(__filename);
module.exports = jiti.import(tsConfigPath, {
    default: true,
});