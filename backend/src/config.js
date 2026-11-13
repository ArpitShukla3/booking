const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const backendRoot = path.resolve(__dirname, '..');

module.exports = {
  port: Number(process.env.PORT) || 4000,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  dataDir: path.resolve(backendRoot, process.env.DATA_DIR || '../hackathon-problem-3-group-travel-matcher'),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'booking',
    password: process.env.DB_PASSWORD || 'booking',
    database: process.env.DB_NAME || 'booking',
  },
};
