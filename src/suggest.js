async function rateLimit(kv, ip) {
  const key = `rate_limit:${ip}`;
  const last = await kv.get(key);
  if (last && Date.now() - parseInt(last, 10) < 60000) return true;
  await kv.put(key, String(Date.now()), { expirationTtl: 86400 });
  return false;
}

export async function handleSuggest(req, env, CORS) {
  const url = new URL(req.url);
  const ip  = req.headers.get('CF-Connecting-IP');

  if (url.pathname === '/suggest' && req.method === 'POST') {
    if (await rateLimit(env.SUGGEST_KV, ip))
      return Response.json({ error: 'Rate limited' }, { status: 429, headers: CORS });

    let body; try { body = await req.json(); } catch { body = {}; }
    if (!body.suggestion?.trim())
      return Response.json({ error: 'Missing suggestion' }, { status: 400, headers: CORS });

    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `New suggestion: ${body.suggestion.trim()}` }),
    });

    return Response.json({ success: true }, { headers: CORS });
  }

  return null; // not handled
}
