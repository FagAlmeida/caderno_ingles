const SYSTEM_PROMPT = `You are a kind, patient English conversation tutor for a Brazilian beginner.
Adapt to the learner's level and keep each reply short (usually 1-3 sentences).
Continue the conversation mainly in simple, natural English. If the learner makes a mistake,
first respond to their meaning, then gently show one useful correction with a brief explanation
in Brazilian Portuguese. Ask one clear follow-up question at a time. Never shame the learner.
If they ask for help in Portuguese, explain simply and then invite them to try in English.`;
const requestCounts = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 20;

function respond(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function isRateLimited(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = (typeof forwardedFor === "string" ? forwardedFor.split(",")[0] : "unknown").trim();
  const now = Date.now();
  const record = requestCounts.get(ip);
  if (record && now - record.startedAt < RATE_WINDOW_MS && record.count >= RATE_LIMIT) return true;
  if (!requestCounts.has(ip) && requestCounts.size >= 500) {
    for (const [key, value] of requestCounts) {
      if (now - value.startedAt >= RATE_WINDOW_MS) requestCounts.delete(key);
    }
    if (requestCounts.size >= 500) requestCounts.delete(requestCounts.keys().next().value);
  }
  if (!record || now - record.startedAt >= RATE_WINDOW_MS) {
    requestCounts.set(ip, { startedAt: now, count: 1 });
  } else {
    record.count += 1;
  }
  return false;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respond(res, 405, { error: "Este endpoint aceita apenas mensagens POST." });
  }

  if (isRateLimited(req)) {
    res.setHeader("Retry-After", "60");
    return respond(res, 429, { error: "Muitas mensagens em pouco tempo. Aguarde um minuto e tente novamente." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return respond(res, 503, {
      error: "Tutor ainda não configurado. Adicione OPENAI_API_KEY nas variáveis de ambiente da Vercel."
    });
  }

  const messages = req.body && req.body.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 12) {
    return respond(res, 400, { error: "Envie de 1 a 12 mensagens para continuar a conversa." });
  }

  const validMessages = messages.every(message =>
    message &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= 600
  );
  const totalCharacters = messages.reduce((total, message) =>
    total + (message && typeof message.content === "string" ? message.content.length : 0), 0
  );
  if (!validMessages || totalCharacters > 6000 || messages[messages.length - 1].role !== "user") {
    return respond(res, 400, { error: "A conversa está fora do formato esperado. Revise sua mensagem e tente novamente." });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 220,
        temperature: 0.6
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!upstream.ok) {
      console.error("OpenAI tutor request failed with status", upstream.status);
      return respond(res, 502, { error: "O serviço do tutor está indisponível. Tente novamente em instantes." });
    }

    const data = await upstream.json();
    const reply = data.choices && data.choices[0] &&
      data.choices[0].message && data.choices[0].message.content;
    if (typeof reply !== "string" || !reply.trim()) {
      console.error("OpenAI tutor returned an empty response");
      return respond(res, 502, { error: "O tutor não conseguiu montar uma resposta. Tente novamente." });
    }

    return respond(res, 200, { reply: reply.trim() });
  } catch (error) {
    console.error("OpenAI tutor request error", error.name || "Error");
    return respond(res, 502, { error: "Não foi possível conectar ao tutor. Confira sua conexão e tente novamente." });
  }
};
