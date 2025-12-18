/* Netlify Function: Chat proxy for OpenRouter and Poe */
const POE_API_KEY = process.env.POE_API_KEY || "";
const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ||
  "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";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const model = typeof payload.model === "string" ? payload.model : "";
    const useOpenRouter = model.includes("/");

    let targetUrl, headers;
    if (useOpenRouter) {
      if (!OPENROUTER_API_KEY) {
        return { statusCode: 500, headers: corsHeaders(), body: "Missing OPENROUTER_API_KEY" };
      }
      targetUrl = "https://openrouter.ai/api/v1/chat/completions";
      headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": event.headers.origin || "https://example.com",
        "X-Title": "Lovable Clone",
      };
    } else {
      if (!POE_API_KEY) {
        return { statusCode: 500, headers: corsHeaders(), body: "Missing POE_API_KEY" };
      }
      targetUrl = "https://api.poe.com/v1/chat/completions";
      headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${POE_API_KEY}`,
        "HTTP-Referer": event.headers.origin || "https://example.com",
        "X-Title": "Lovable Clone",
      };
    }

    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const contentType = upstream.headers.get("content-type") || "application/json";
    const body = await upstream.text();

    return {
      statusCode: upstream.status,
      headers: { ...corsHeaders(), "content-type": contentType },
      body,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: `Server error: ${err?.message || String(err)}`,
    };
  }
};

