javascript
// ServeEarn backend API
// Talks to Supabase (Postgres) using the SERVICE ROLE key, which lives only
// in Netlify's environment variables and is never exposed to the browser.
//
// The site's front-end talks ONLY to this function (/.netlify/functions/api),
// never directly to Supabase.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function headers() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server not configured: missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars.' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { action, key, value, prefix } = payload;

  try {
    if (action === 'set') {
      if (!key) return { statusCode: 400, body: JSON.stringify({ error: 'key required' }) };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
        method: 'POST',
        headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('Supabase set failed', res.status, text);
        return { statusCode: 502, body: JSON.stringify({ error: 'Supabase set failed', detail: text }) };
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'get') {
      if (!key) return { statusCode: 400, body: JSON.stringify({ error: 'key required' }) };
      const url = `${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`;
      const res = await fetch(url, { headers: headers() });
      if (!res.ok) {
        const text = await res.text();
        console.error('Supabase get failed', res.status, text);
        return { statusCode: 502, body: JSON.stringify({ error: 'Supabase get failed', detail: text }) };
      }
      const rows = await res.json();
      return { statusCode: 200, body: JSON.stringify({ value: rows.length ? rows[0].value : null }) };
    }

    if (action === 'list') {
      const p = prefix || '';
      const url = `${SUPABASE_URL}/rest/v1/kv_store?key=like.${encodeURIComponent(p)}*&select=key`;
      const res = await fetch(url, { headers: headers() });
      if (!res.ok) {
        const text = await res.text();
        console.error('Supabase list failed', res.status, text);
        return { statusCode: 502, body: JSON.stringify({ error: 'Supabase list failed', detail: text }) };
      }
      const rows = await res.json();
      return { statusCode: 200, body: JSON.stringify({ keys: rows.map((r) => r.key) }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};

