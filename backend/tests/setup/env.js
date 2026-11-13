// Loaded with `node --import` before any test file, so config.js sees NODE_ENV=test
// and every DB connection goes to the test database, never the dev one.
process.env.NODE_ENV = 'test';
