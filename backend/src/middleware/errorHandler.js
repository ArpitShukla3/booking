const HttpError = require('../utils/HttpError');

// Every error response uses one shape: { error: { message, fields? } }

function notFound(req, res) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    const error = { message: err.message };
    if (err.fields) error.fields = err.fields;
    return res.status(err.status).json({ error });
  }
  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Invalid JSON body' } });
  }
  console.error(err);
  return res.status(500).json({ error: { message: 'Internal server error' } });
}

module.exports = { notFound, errorHandler };
