// ServeEarn backend API
// Uses Netlify Blobs (built into Netlify, zero configuration) for storage.
// No external database, no credentials to manage.

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { action, key, value, prefix } = payload;
  const store = getStore({ name: 'serveearn-data' });

  try {
    if (action === 'set') {
      if (!key) return { statusCode: 400, body: JSON.stringify({ error: 'key required' }) };
      await store.setJSON(key, value);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'get') {
      if (!key) return { statusCode: 400, body: JSON.stringify({ error: 'key required' }) };
      const val = await store.get(key, { type: 'json' });
      return { statusCode: 200, body: JSON.stringify({ value: val === undefined ? null : val }) };
    }

    if (action === 'list') {
      const p = prefix || '';
      const { blobs } = await store.list({ prefix: p });
      return { statusCode: 200, body: JSON.stringify({ keys: blobs.map((b) => b.key) }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    console.error('Blobs error', e);
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};
