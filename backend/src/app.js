// Builds the Express app without starting it, so tests can import it (supertest).
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Hotel photos are stored in the DB exactly as in the data pack
// ("images/hotels/HOTEL-TWIN-1.jpg"), so serving the pack's images/ folder
// at /images makes `${API_URL}/${hotel.image}` a working URL.
app.use('/images', express.static(path.join(config.dataDir, 'images')));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
