const js = require('@eslint/js');
const globals = require('globals');

// Helpers defined in utils.js and shared with app.js as browser globals.
const utilsGlobals = Object.fromEntries(
  ['CSV_HEADER', 'generateId', 'parseLocalDate', 'formatLocalDate', 'todayLocalIso', 'escapeCsvValue', 'parseCsv', 'parseVisits', 'personKey']
    .map((name) => [name, 'readonly'])
);

module.exports = [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    files: ['app.js', 'utils.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, module: 'readonly' } },
  },
  {
    files: ['app.js'],
    languageOptions: { globals: utilsGlobals },
  },
  {
    files: ['utils.js'],
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '.*' }] },
  },
  {
    files: ['service-worker.js'],
    languageOptions: { sourceType: 'script', globals: globals.serviceworker },
  },
  {
    files: ['tests/**/*.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
];
