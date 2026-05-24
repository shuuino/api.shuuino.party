/* same as suggest.js
take in suggestions,
send through webhook (because I can),
and store them.
Then load the most recent 50 on demand, and if it reaches the top it should request the next 50.*/

const RATE_LIMIT_TTL_SECONDS = 60;
const MAX_REVERSE_TIMESTAMP = 9999999999999n;

async function rateLimit(kv, ip) {
  const key = `rate_limit:${ip}`;
  const last = await kv.get(key);
  if (last && Date.now() - parseInt(last, 10) < 60000) return true;
  await kv.put(key, String(Date.now()), { expirationTtl: RATE_LIMIT_TTL_SECONDS });
  return false;
}

function formatName(name) {
  const trimmed = String(name ?? '').trim();
  return trimmed || 'anonymous';
}

function createCommentKey() {
  const reverseTimestamp = MAX_REVERSE_TIMESTAMP - BigInt(Date.now());
  return `comment:${reverseTimestamp.toString().padStart(13, '0')}:${Math.random().toString(36).slice(2, 10)}`;
}

function verifyAdminPassword(password, adminPassword) {
  return Boolean(password) && Boolean(adminPassword) && password === adminPassword; //am i retarded?
}

async function sendDiscordWebhook(webhookUrl, content) {
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch {
    // send message even if webhook fails ig
  }
}

async function getComments(kv, cursor) {
  const options = { prefix: 'comment:', limit: 50 };
  if (cursor) options.cursor = cursor;
  const list = await kv.list(options);
  const values = await Promise.all(
    (list.keys || []).map((entry) => kv.get(entry.name))
  );

  const comments = list.keys
    .map((entry, idx) => {
      try {
        const value = JSON.parse(values[idx]);
        return { ...value, id: entry.name };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return { comments, cursor: list.cursor };
}

export async function handleGuestbook(req, env, CORS) {
  const url = new URL(req.url);
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';

  if (url.pathname === '/guestbook' && req.method === 'GET') {
    const cursor = url.searchParams.get('cursor');
    const result = await getComments(env.GUESTBOOK_KV, cursor);
    return Response.json(result, { headers: CORS });
  }

  if (url.pathname === '/guestbook' && req.method === 'POST') {
    if (await rateLimit(env.GUESTBOOK_KV, ip))
      return Response.json({ error: 'Rate limited' }, { status: 429, headers: CORS });

    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const message = String(body.message ?? '').trim();
    if (!message) {
      return Response.json({ error: 'Missing message' }, { status: 400, headers: CORS });
    }

    const comment = {
      name: formatName(body.name),
      message,
      createdAt: new Date().toISOString(),
    };

    await env.GUESTBOOK_KV.put(createCommentKey(), JSON.stringify(comment));

    const webhookUrl = env.GUESTBOOK_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
    await sendDiscordWebhook(webhookUrl, `Guestbook comment from ${comment.name}: ${comment.message}`);

    return Response.json({ success: true, comment }, { headers: CORS });
  }

  if (url.pathname.startsWith('/guestbook/') && url.pathname.endsWith('/reply') && req.method === 'POST') {
    const commentId = url.pathname.split('/')[2];
    if (!commentId) {
      return Response.json({ error: 'Invalid comment ID' }, { status: 400, headers: CORS });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const password = String(body.password ?? '').trim();
    const authHeader = req.headers.get('Authorization') || '';
    const authToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

    if (!verifyAdminPassword(password, env.ADMIN_PASSWORD) && !verifyAdminPassword(authToken, env.ADMIN_PASSWORD)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
    }

    const replyMessage = String(body.message ?? '').trim();
    if (!replyMessage) {
      return Response.json({ error: 'Missing message' }, { status: 400, headers: CORS });
    }

    const reply = {
      name: 'Shuuino',
      message: replyMessage,
      createdAt: new Date().toISOString(),
      replyTo: commentId,
    };

    await env.GUESTBOOK_KV.put(createCommentKey(), JSON.stringify(reply));

    const webhookUrl = env.GUESTBOOK_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
    await sendDiscordWebhook(webhookUrl, `Your dumbass replied: ${replyMessage}`); //i'm sending this via a webhook to myself what do i care what i put in the message

    return Response.json({ success: true, reply }, { headers: CORS });
  }

  return null;
}
