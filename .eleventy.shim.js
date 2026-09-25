// .eleventy.js  (CommonJS shim)
console.log('[11ty] shim loaded');
require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
    }
});

// wenn deine TS-Config `export default ...` nutzt:
module.exports = require('./.eleventy.config.ts').default;
// falls kein default export: module.exports = require('./eleventy.config.ts');