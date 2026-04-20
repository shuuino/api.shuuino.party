import { handlePoll }    from './poll.js';
import { handleSuggest } from './suggest.js';

function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (origin === 'https://shuuino.party' || origin.endsWith('.shuuino.party'))
    ? origin : 'https://shuuino.party';
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export default {
  async fetch(req, env) {
    const CORS = corsHeaders(req);
    if (req.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: CORS });

    const res =
      await handlePoll(req, env, CORS) ??
      await handleSuggest(req, env, CORS);

    if (res) return res;
    return new Response('Not found', { status: 404 });
  },
};
