const db = require('./client');

/**
 * Run `work(trx)` inside one Postgres transaction.
 * Services use this when several helper calls must succeed or fail together
 * (e.g. approve a join request + add the member). Pass `trx` on to each helper.
 *
 *   await withTransaction(async (trx) => {
 *     await joinRequestHelper.updateStatus(id, 'APPROVED', trx);
 *     await groupHelper.addMember(groupId, travellerId, trx);
 *   });
 */
function withTransaction(work) {
  return db.transaction(work);
}

module.exports = { withTransaction };
