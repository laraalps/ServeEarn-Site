// ServeEarn backend API
// Reads and writes a simple key-value table in Netlify Database (Postgres).
//
// The site's front-end talks ONLY to this function (/.netlify/functions/api),
// never directly to the database.

const { getDatabase } = require('@netlify/database');

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
  const db = getDatabase();

  try {
    if (action === 'set') {
      if (!key) return { statusCode: 400, body: JSON.stringify({ error: 'key required' }) };
      await db.sql`
        INSERT INTO kv_store (key, value, updated_at)
        VALUES (${key}, ${JSON.stringify(value)}::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
      `;
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'get') {
      if (!key) return { statusCode: 400, body: JSON.stringify({ error: 'key required' }) };
      const rows = await db.sql`SELECT value FROM kv_store WHERE key = ${key}`;
      return { statusCode: 200, body: JSON.stringify({ value: rows.length ? rows[0].value : null }) };
    }

    if (action === 'list') {
      const p = prefix || '';
      const rows = await db.sql`SELECT key FROM kv_store WHERE key LIKE ${p + '%'}`;
      return { statusCode: 200, body: JSON.stringify({ keys: rows.map((r) => r.key) }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    console.error('Database operation failed', e);
    return { statusCode: 502, body: JSON.stringify({ error: 'Database operation failed', detail: String(e) }) };
  }
};
