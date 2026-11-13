const healthService = require('../services/health.service');

async function getHealth(req, res) {
  const { ok, ...body } = await healthService.getStatus();
  res.status(ok ? 200 : 503).json(body);
}

module.exports = { getHealth };
