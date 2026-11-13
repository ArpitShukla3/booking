// TASK-X3 / organiser rule 5: the running app must not call any AI/LLM model. Ollama is used only by
// the offline scripts in scripts/reviews/. This guard fails if app code references it.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

describe('no model at runtime', () => {
  it('nothing under src/ talks to Ollama or another model API', () => {
    const offenders = files(path.resolve(__dirname, '../../../src'))
      .filter((f) => /ollama|11434|\/api\/embed|\/api\/chat|openai|anthropic/i.test(fs.readFileSync(f, 'utf8')));
    assert.deepEqual(offenders, []);
  });
});
