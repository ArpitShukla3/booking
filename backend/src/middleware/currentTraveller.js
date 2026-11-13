// Identity: who is calling? The ONLY place that reads the traveller id from a request.
// Today it is the `X-Traveller-Id` header (tasks/PLAN.md §2.1). If the transport changes
// (cookie, token, body field), change readTravellerId() only.
const travellersHelper = require('../helpers/postgres/travellers.helper');
const HttpError = require('../utils/HttpError');

function readTravellerId(req) {
  const raw = req.get('X-Traveller-Id');
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

/** 401 unless the request names an existing traveller; sets req.traveller. */
async function requireTraveller(req, _res, next) {
  const travellerId = readTravellerId(req);
  if (!/^T-\d{3,}$/.test(travellerId)) throw HttpError.unauthorized('Sign in to continue');
  const traveller = await travellersHelper.findById(travellerId);
  if (!traveller) throw HttpError.unauthorized('Your traveller ID was not found. Sign in again.');
  req.traveller = traveller;
  next();
}

module.exports = { requireTraveller, readTravellerId };
