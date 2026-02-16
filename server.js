/**
 * SH Frontend Proxy (Railway) — FINAL
 * - Serves static site from /public
 * - Proxies POST /api/public/chat to backend
 * - Injects x-sh-api-key securely from env
 */

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));

// ===============================
// ENV
// ===============================
const PORT = process.env.PORT || 3000;

// Backend chat endpoint (FULL URL)
const BACKEND_URL = (
  process.env.BACKEND_URL ||
  "https://sh-backend-api-production-5b7e.up.railway.app/api/public/chat"
).trim();

// Trim to avoid Railway newline issues
const SH_API_KEY = (process.env.SH_API_KEY || "").trim();

// Build identifier
const BUILD_TAG =
  process.env.RAILWAY_GIT_COMMIT_SHA || `local-${Date.now()}`;

// ===============================
// STATIC FRONTEND
// ===============================
app.use(
  express.static("public", {
    etag: false,
    maxAge: 0,
    setHeaders: (res, filePath) => {
      // Force no caching for HTML/JS/CSS so browser can't keep old code
      if (filePath.endsWith(".html") || filePath.endsWith(".js") || filePath.endsWith(".css")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    },
  })
);

// ===============================
// HEALTH & DEBUG
// ===============================
app.get("/health", (req, res) => {
  res.json({ ok: true, build: BUILD_TAG });
});

// Safe debug — does NOT expose secrets
app.get("/debug/proxy", (req, res) => {
  res.json({
    build: BUILD_TAG,
    backendUrl: BACKEND_URL,
    hasShApiKey: Boolean(SH_API_KEY),
  });
});

// ===============================
// PROXY ROUTE (BROWSER CALLS THIS)
// ===============================
app.post("/api/public/chat", async (req, res) => {
  try {
    if (!SH_API_KEY) {
      return res.status(500).json({
        error: "SH_API_KEY missing in Railway variables (frontend proxy)",
        build: BUILD_TAG,
      });
    }

    const upstream = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sh-api-key": SH_API_KEY,
      },
      body: JSON.stringify(req.body || {}),
    });

    const text = await upstream.text();

    // Forward status + content type
    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json"
    );

    return res.send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({
      error: "Proxy error",
      details: err?.message || String(err),
      build: BUILD_TAG,
    });
  }
});

// ===============================
// FALLBACK → FRONTEND
// ===============================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===============================
// START
// ===============================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Frontend proxy running on ${PORT} | build ${BUILD_TAG}`);
});
