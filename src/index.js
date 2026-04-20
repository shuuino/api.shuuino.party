import { handlePoll }    from './poll.js';
import { handleSuggest } from './suggest.js';

const ALLOWED = ['https://shuuino.party', 'https://preview.shuuino.party'];

function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = ALLOWED.includes(origin) ? origin : ALLOWED[0];
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
