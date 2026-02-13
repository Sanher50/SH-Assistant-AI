export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors(), body: "" };
  }

  // Only POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...cors(), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const SH_API_KEY = process.env.SH_API_KEY;
    if (!SH_API_KEY) {
      return {
        statusCode: 500,
        headers: { ...cors(), "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing SH_API_KEY in Netlify env vars" })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const message = body.message;

    if (!message || typeof message !== "string") {
      return {
        statusCode: 400,
        headers: { ...cors(), "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Message is required" })
      };
    }

    // Forward to Railway backend (NO :8080 in URL)
    const response = await fetch(
      "https://sh-backend-api-production.up.railway.app/api/ai/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SH_API_KEY
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: message }]
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { ...cors(), "Content-Type": "application/json" },
        body: JSON.stringify({
          error: data?.message || "SH Backend API error",
          details: data
        })
      };
    }

    const reply =
      data.reply ||
      data.text ||
      data.message ||
      data.output ||
      (data.choices?.[0]?.message?.content ?? "");

    return {
      statusCode: 200,
      headers: { ...cors(), "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...cors(), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server failed", details: String(err) })
    };
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
