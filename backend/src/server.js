// Entry point: starts the HTTP server. App setup lives in app.js.
const app = require('./app');
const config = require('./config');
const healthHelper = require('./helpers/postgres/health.helper');

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

const shutdown = async () => {
  server.close();
  await healthHelper.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
