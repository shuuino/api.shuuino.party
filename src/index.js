import { handlePoll }    from './poll.js';
import { handleSuggest } from './suggest.js';

const CORS = {
  'Access-Control-Allow-Origin':  'https://preview.shuuino.party',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: CORS });

    const res =
      await handlePoll(req, env, CORS) ??
      await handleSuggest(req, env, CORS);

    if (res) return res;
    return new Response('Not found', { status: 404 });
  },
};
