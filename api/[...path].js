let cached;

module.exports = async (req, res) => {
  try {
    // In some Vercel runtimes the catch-all function receives req.url without the "/api" prefix.
    // Your Express routes are mounted under "/api/*", so normalize here to avoid false 404s.
    if (typeof req.url === "string" && !req.url.startsWith("/api/")) {
      req.url = req.url.startsWith("/") ? `/api${req.url}` : `/api/${req.url}`;
    }

    if (!cached) {
      cached = await import("../dist/site/server/server.mjs");
    }

    if (typeof cached.reqHandler !== "function") {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Server handler not found in server.mjs" }));
      return;
    }

    return cached.reqHandler(req, res);
  } catch (err) {
    console.error("[Vercel API Function] Failed to handle request:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "Failed to start API handler",
        message: err && err.message ? err.message : String(err)
      })
    );
  }
};


