const POLL_OPTIONS = [
  { id: 'ds-compatibility', label: 'Nintendo DS compatibility' },
  { id: 'guestbook',        label: 'guestbook / visitor comments' },
  { id: 'repost-search',    label: 'search / filter through reposts' },
  { id: 'accessibility-settings',  label: 'change font, font size, disable effects, etc' },
  { id: 'theme-toggle',     label: 'light mode toggle' },
];

async function getOptions(kv) {
  return Promise.all(
    POLL_OPTIONS.map(async (o) => ({
      ...o,
      votes: parseInt((await kv.get('vote:' + o.id)) || '0', 10),
    }))
  );
}

async function rateLimit(kv, ip) {
  const key = `rate_limit:${ip}`;
  const last = await kv.get(key);
  if (last && Date.now() - parseInt(last, 10) < 60000) return true;
  await kv.put(key, String(Date.now()), { expirationTtl: 86400 });
  return false;
}

export async function handlePoll(req, env, CORS) {
  const url = new URL(req.url);
  const ip  = req.headers.get('CF-Connecting-IP');

  if (url.pathname === '/poll/votes' && req.method === 'GET') {
    return Response.json({ options: await getOptions(env.POLL_KV) }, { headers: CORS });
  }

  if (url.pathname === '/poll/vote' && req.method === 'POST') {
    if (await rateLimit(env.POLL_KV, ip))
      return Response.json({ error: 'Rate limited' }, { status: 429, headers: CORS });

    let body; try { body = await req.json(); } catch { body = {}; }
    const opt = POLL_OPTIONS.find((o) => o.id === body.id);
    if (!opt) return Response.json({ error: 'Invalid option' }, { status: 400, headers: CORS });

    const cur = parseInt((await env.POLL_KV.get('vote:' + opt.id)) || '0', 10);
    await env.POLL_KV.put('vote:' + opt.id, String(cur + 1));
    try {
      await fetch(env.POLL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `Poll vote: ${opt.label}` }),
  });
} catch {}
    return Response.json({ options: await getOptions(env.POLL_KV) }, { headers: CORS });
  }

  return null; // not handled
}
