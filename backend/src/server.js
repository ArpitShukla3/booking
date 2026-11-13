const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./db');

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Hotel photos are stored in the DB exactly as in the data pack
// ("images/hotels/HOTEL-TWIN-1.jpg"), so serving the pack's images/ folder
// at /images makes `${API_URL}/${hotel.image}` a working URL.
app.use('/images', express.static(path.join(config.dataDir, 'images')));

app.get('/api/health', async (req, res) => {
  try {
    await db.raw('select 1');
    res.json({ status: 'ok', db: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'down', message: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

const shutdown = async () => {
  server.close();
  await db.destroy();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
