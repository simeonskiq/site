let cached;

module.exports = async (req, res) => {
  if (!cached) {
    cached = await import("../dist/site/server/server.mjs");
  }
  return cached.reqHandler(req, res);
};


