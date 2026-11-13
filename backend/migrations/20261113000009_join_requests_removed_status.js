// M5 follow-up: an owner can remove a member. The (group, member) join request becomes REMOVED,
// which (like REJECTED) stops the traveller from asking to join that group again.
exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE join_requests
    DROP CONSTRAINT join_requests_status_chk,
    ADD CONSTRAINT join_requests_status_chk CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REMOVED'))`);
};

exports.down = async function down(knex) {
  // REMOVED rows have no older equivalent; REJECTED keeps the "cannot request again" meaning.
  await knex('join_requests').where({ status: 'REMOVED' }).update({ status: 'REJECTED' });
  await knex.raw(`ALTER TABLE join_requests
    DROP CONSTRAINT join_requests_status_chk,
    ADD CONSTRAINT join_requests_status_chk CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))`);
};
