/**
 * Throw from a service to send a specific HTTP status to the client.
 *   throw new HttpError(400, 'Invalid search', { check_in: 'Must be on or after 2027-04-01' });
 *   throw HttpError.notFound('Group not found');
 */
class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.fields = fields;
  }

  static badRequest(message, fields) { return new HttpError(400, message, fields); }
  static unauthorized(message = 'Unauthorized') { return new HttpError(401, message); }
  static forbidden(message = 'Forbidden') { return new HttpError(403, message); }
  static notFound(message = 'Not found') { return new HttpError(404, message); }
  static conflict(message) { return new HttpError(409, message); }
}

module.exports = HttpError;
