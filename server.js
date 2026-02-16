/**
 * SH Frontend Proxy (Railway)
 * - Serves static site from /public
 * - Proxies POST /api/public/chat to your backend, adding x-sh-api-key from env
 */

const express = require("express");

const app = express();
app.use(express.json({ limit: "1mb" }));

// ===============================
// ENV
// ===============================
const PORT = process.env.PORT || 3000;

// Your BACKEND chat endpoint (full URL)
const BACKEND_URL = (process.env.BACKEND_URL ||
  "https://sh-backend-api-production-5b7e.up.railway.app/api/public/chat"
).trim();

const SH_API_KEY = (process.env.SH_API_KEY || "").trim();

// Build identifier
const BUILD_TAG = process.env.RAILWAY_GIT_COMMIT_SHA || `local-${Date.now()}`;

// ===============================
// STATIC FRONTEND
// ===============================
app.use(express.static("public"));

// Health
app.get("/health", (req, res) => res.json({ ok: true, build: BUILD_TAG }));

// Debug (safe — does not reveal secrets)
app.get("/debug/proxy", (req, res) => {
  res.json({
    build: BUILD_TAG,
    backendUrl: BACKEND_URL,
    hasShApiKey: Boolean(SH_API_KEY),
  });
});

// ===============================
// PROXY ROUTE (browser calls this)
// ===============================
app.post("/api/public/chat", async (req, res) => {
  try {
    if (!SH_API_KEY) {
      return res.status(500).json({
        error: "SH_API_KEY missing in Railway variables (frontend proxy service)",
        build: BUILD_TAG,
      });
    }

    const upstream = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sh-api-key": SH_API_KEY
      },
      body: JSON.stringify(req.body || {})
    });

    const text = await upstream.text();

    // forward status + body
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (err) {
    return res.status(500).json({
      error: "Proxy error",
      details: err?.message || String(err),
      build: BUILD_TAG,
    });
  }
});

// Fallback to index.html for direct visits
app.get("*", (req, res) => {
  res.sendFile(require("path").join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Frontend proxy running on ${PORT} | build ${BUILD_TAG}`);
});
