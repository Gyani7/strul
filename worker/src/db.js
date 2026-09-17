// ── Database helpers (Supabase + D1) ──────────────────────────

// ── Supabase REST (PostgREST) calls using service role key ──

async function supabaseRequest(env, table, method, options = {}) {
  const base = `${env.SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY,
    'authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY}`,
    'content-type': 'application/json',
    'prefer': options.prefer || 'return=representation',
  };

  let url = base;
  if (options.query) {
    const params = new URLSearchParams(options.query);
    url = `${base}?${params}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} failed: ${res.status} ${text}`);
  }

  if (method === 'DELETE') return null;
  return res.json();
}

// ── Fetch a single link by shortcode from Supabase ──
export async function fetchLinkFromDB(env, shortcode) {
  const rows = await supabaseRequest(env, 'links', 'GET', {
    query: {
      select: 'id,shortcode,destination_url,title,is_active,expires_at,password_hash,creator_id,is_guest,permanent',
      'shortcode': `eq.${shortcode}`,
      limit: '1',
    },
  });
  return rows && rows.length > 0 ? rows[0] : null;
}

// ── Fetch a single link by numeric ID from Supabase ──
export async function fetchLinkById(env, id) {
  const rows = await supabaseRequest(env, 'links', 'GET', {
    query: {
      select: 'id,shortcode,destination_url,title,is_active,expires_at,password_hash,creator_id,is_guest,permanent',
      'id': `eq.${id}`,
      limit: '1',
    },
  });
  return rows && rows.length > 0 ? rows[0] : null;
}

// ── Fetch all active links for cache preload ──
export async function fetchAllActiveLinks(env) {
  const all = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const batch = await supabaseRequest(env, 'links', 'GET', {
      query: {
        select: 'id,shortcode,destination_url,title,is_active,expires_at,password_hash,creator_id,is_guest,permanent',
        'is_active': 'eq.true',
        order: 'id.asc',
        limit: String(pageSize),
        offset: String(offset),
      },
    });
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

// ── Fetch expired/inactive links for KV cleanup ──
export async function fetchExpiredLinks(env) {
  const now = new Date().toISOString();
  const rows = await supabaseRequest(env, 'links', 'GET', {
    query: {
      select: 'shortcode',
      'or': `(is_active.eq.false,expires_at.lt.${now})`,
      limit: '1000',
    },
  });
  return rows || [];
}

// ── Create link in Supabase ──
export async function createLinkInDB(env, linkData) {
  return supabaseRequest(env, 'links', 'POST', {
    body: linkData,
    prefer: 'return=representation',
  });
}

// ── Update link in Supabase ──
export async function updateLinkInDB(env, id, updates) {
  return supabaseRequest(env, 'links', 'PATCH', {
    query: { 'id': `eq.${id}` },
    body: updates,
    prefer: 'return=representation',
  });
}

// ── Delete link in Supabase ──
export async function deleteLinkFromDB(env, id) {
  return supabaseRequest(env, 'links', 'DELETE', {
    query: { 'id': `eq.${id}` },
  });
}

// ── Batch upsert click statistics into Supabase ──
export async function batchUpsertClickStats(env, rows) {
  if (!rows || rows.length === 0) return;
  return supabaseRequest(env, 'click_statistics', 'POST', {
    body: rows,
    prefer: 'resolution=merge-duplicates',
  });
}

// ── Batch upsert daily statistics into Supabase ──
export async function batchUpsertDailyStats(env, rows) {
  if (!rows || rows.length === 0) return;
  return supabaseRequest(env, 'daily_statistics', 'POST', {
    body: rows,
    prefer: 'resolution=merge-duplicates',
  });
}

// ── D1: write click event to aggregation buffer ──
export async function d1RecordClick(env, event) {
  const stmt = env.SHORTUL_DB.prepare(
    `INSERT INTO click_buffer (shortcode, clicked_at, country, device_type, referrer, visitor_hash)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  await stmt.bind(
    event.shortcode,
    event.clicked_at,
    event.country || null,
    event.device_type || null,
    event.referrer || null,
    event.visitor_hash || null
  ).run();
}

// ── D1: read and aggregate click buffer ──
export async function d1ReadAggregates(env) {
  // Aggregate by shortcode + date + hour
  const stmt = env.SHORTUL_DB.prepare(`
    SELECT
      shortcode,
      DATE(clicked_at) as click_date,
      strftime('%H', clicked_at) as click_hour,
      country,
      device_type,
      referrer,
      COUNT(*) as click_count,
      COUNT(DISTINCT visitor_hash) as unique_visitors
    FROM click_buffer
    WHERE synced = 0
    GROUP BY shortcode, click_date, click_hour, country, device_type, referrer
  `);
  const result = await stmt.all();
  return result.results || [];
}

// ── D1: mark buffer rows as synced ──
export async function d1MarkSynced(env) {
  await env.SHORTUL_DB.prepare(`UPDATE click_buffer SET synced = 1 WHERE synced = 0`).run();
}

// ── D1: cleanup old synced rows (keep 7 days) ──
export async function d1CleanupSynced(env) {
  await env.SHORTUL_DB.prepare(
    `DELETE FROM click_buffer WHERE synced = 1 AND clicked_at < datetime('now', '-7 days')`
  ).run();
}

// ── D1: admin stats ──
export async function d1AdminStats(env) {
  const totalClicks = await env.SHORTUL_DB.prepare(
    `SELECT COUNT(*) as cnt FROM click_buffer`
  ).first();
  const todayClicks = await env.SHORTUL_DB.prepare(
    `SELECT COUNT(*) as cnt FROM click_buffer WHERE DATE(clicked_at) = DATE('now')`
  ).first();
  const topLinks = await env.SHORTUL_DB.prepare(
    `SELECT shortcode, COUNT(*) as clicks FROM click_buffer
     WHERE synced = 0 GROUP BY shortcode ORDER BY clicks DESC LIMIT 10`
  ).all();
  return {
    total_clicks: totalClicks?.cnt || 0,
    today_clicks: todayClicks?.cnt || 0,
    top_links: topLinks.results || [],
  };
}
