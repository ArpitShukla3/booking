// M5 follow-ups: a seeker can cancel a pending request (CANCELLED), a member can leave (LEFT),
// pending requests close automatically when the group fills up (CLOSED), and a request can carry
// an optional note to the organiser. CANCELLED / LEFT / CLOSED rows can be re-opened later.
const ALL = "'PENDING', 'APPROVED', 'REJECTED', 'REMOVED', 'CANCELLED', 'LEFT', 'CLOSED'";
const BEFORE = "'PENDING', 'APPROVED', 'REJECTED', 'REMOVED'";

exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE join_requests
    DROP CONSTRAINT join_requests_status_chk,
    ADD CONSTRAINT join_requests_status_chk CHECK (status IN (${ALL})),
    ADD COLUMN message text,
    ADD CONSTRAINT join_requests_message_chk CHECK (message IS NULL OR length(message) BETWEEN 1 AND 500)`);
};

exports.down = async function down(knex) {
  // The old schema has no equivalent: drop the new rows' meaning onto the closest old status.
  await knex('join_requests').whereIn('status', ['CANCELLED', 'CLOSED']).update({ status: 'REJECTED' });
  await knex('join_requests').where({ status: 'LEFT' }).update({ status: 'REMOVED' });
  await knex.raw(`ALTER TABLE join_requests
    DROP CONSTRAINT join_requests_message_chk,
    DROP COLUMN message,
    DROP CONSTRAINT join_requests_status_chk,
    ADD CONSTRAINT join_requests_status_chk CHECK (status IN (${BEFORE}))`);
};
