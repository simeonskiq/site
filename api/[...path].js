let cached;

module.exports = async (req, res) => {
  try {

    if (typeof req.url === "string") {
      const u = new URL(req.url, "http://localhost");
      const p = u.searchParams.get("p");
      if (p) {
        u.searchParams.delete("p");
        const cleaned = p.startsWith("/") ? p.slice(1) : p;
        const nextPath = `/api/${cleaned}`;
        req.url = u.searchParams.toString()
          ? `${nextPath}?${u.searchParams.toString()}`
          : nextPath;
      } else if (!req.url.startsWith("/api/")) {
        req.url = req.url.startsWith("/") ? `/api${req.url}` : `/api/${req.url}`;
      }
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


