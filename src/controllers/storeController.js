const storeRepo = require('../db/repositories/storeRepo');

function list(req, res) {
  const start = Date.now();
  const data = storeRepo.findAll();
  res.json({
    success: true,
    data,
    meta: { durationMs: Date.now() - start }
  });
}

module.exports = {
  list
};
