// Fake Express `res` for UNIT tests of controllers and middleware.
function mockRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.send = (body) => { res.body = body; return res; };
  res.sendStatus = (code) => { res.statusCode = code; return res; };
  return res;
}

module.exports = { mockRes };
