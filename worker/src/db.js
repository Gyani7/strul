// ── Database helpers (Supabase + D1) ──────────────────────────

// ============================================================
// SUPABASE REST
// ============================================================

async function supabaseRequest(env, table, method, options = {}) {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  const base = `${env.SUPABASE_URL}/rest/v1/${table}`;

  const headers = {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
    prefer: options.prefer || 'return=representation',
  };

  let url = base;

  if (options.query) {
    const params = new URLSearchParams(options.query);
    url = `${base}?${params.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined
      ? JSON.stringify(options.body)
      : undefined,
  });

  if (!res.ok) {
    const text = await res.text();

    throw new Error(
      `Supabase ${method} ${table} failed: ${res.status} ${text}`
    );
  }

  if (method === 'DELETE') {
    return null;
  }

  const text = await res.text();

  if (!text) {
    return [];
  }

  return JSON.parse(text);
}

// ============================================================
// LINK SELECT
// ============================================================

const LINK_SELECT =
  'id,shortcode,destination_url,title,is_active,expires_at,password_hash,creator_id,is_guest,permanent';

// ============================================================
// FETCH LINK BY SHORTCODE
// ============================================================

export async function fetchLinkFromDB(env, shortcode) {
  if (!shortcode) return null;

  const rows = await supabaseRequest(env, 'links', 'GET', {
    query: {
      select: LINK_SELECT,
      shortcode: `eq.${shortcode}`,
      limit: '1',
    },
  });

  return rows && rows.length > 0 ? rows[0] : null;
}

// ============================================================
// FETCH LINK BY ID
// ============================================================

export async function fetchLinkById(env, id) {
  if (!id) return null;

  const rows = await supabaseRequest(env, 'links', 'GET', {
    query: {
      select: LINK_SELECT,
      id: `eq.${id}`,
      limit: '1',
    },
  });

  return rows && rows.length > 0 ? rows[0] : null;
}

// ============================================================
// FETCH USER'S LINK BY ID
// ============================================================

export async function fetchUserLinkById(env, id, userId) {
  if (!id || !userId) return null;

  const rows = await supabaseRequest(env, 'links', 'GET', {
    query: {
      select: LINK_SELECT,
      id: `eq.${id}`,
      creator_id: `eq.${userId}`,
      limit: '1',
    },
  });

  return rows && rows.length > 0 ? rows[0] : null;
}

// ============================================================
// FETCH ALL ACTIVE LINKS
// Used by morning KV preload.
// ============================================================

export async function fetchAllActiveLinks(env) {
  const all = [];

  let offset = 0;

  const pageSize = 1000;

  while (true) {
    const batch = await supabaseRequest(env, 'links', 'GET', {
      query: {
        select: LINK_SELECT,
        is_active: 'eq.true',
        order: 'id.asc',
        limit: String(pageSize),
        offset: String(offset),
      },
    });

    if (!batch || batch.length === 0) {
      break;
    }

    all.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return all;
}

// ============================================================
// FETCH EXPIRED / INACTIVE LINKS
// ============================================================

export async function fetchExpiredLinks(env) {
  const now = new Date().toISOString();

  const rows = await supabaseRequest(env, 'links', 'GET', {
    query: {
      select: 'shortcode',
      or: `(is_active.eq.false,expires_at.lt.${now})`,
      limit: '1000',
    },
  });

  return rows || [];
}

// ============================================================
// CREATE LINK
// ============================================================

export async function createLinkInDB(env, linkData) {
  return supabaseRequest(env, 'links', 'POST', {
    body: linkData,
    prefer: 'return=representation',
  });
}

// ============================================================
// UPDATE LINK
// ============================================================

export async function updateLinkInDB(env, id, updates) {
  if (!id) {
    throw new Error('Link ID is required');
  }

  return supabaseRequest(env, 'links', 'PATCH', {
    query: {
      id: `eq.${id}`,
    },
    body: updates,
    prefer: 'return=representation',
  });
}

// ============================================================
// UPDATE USER'S OWN LINK
// ============================================================

export async function updateUserLinkInDB(
  env,
  id,
  userId,
  updates
) {
  if (!id || !userId) {
    throw new Error('Link ID and user ID are required');
  }

  return supabaseRequest(env, 'links', 'PATCH', {
    query: {
      id: `eq.${id}`,
      creator_id: `eq.${userId}`,
    },
    body: updates,
    prefer: 'return=representation',
  });
}

// ============================================================
// DELETE LINK
// ============================================================

export async function deleteLinkFromDB(env, id) {
  if (!id) {
    throw new Error('Link ID is required');
  }

  return supabaseRequest(env, 'links', 'DELETE', {
    query: {
      id: `eq.${id}`,
    },
    prefer: 'return=minimal',
  });
}

// ============================================================
// DELETE USER'S OWN LINK
// ============================================================

export async function deleteUserLinkFromDB(
  env,
  id,
  userId
) {
  if (!id || !userId) {
    throw new Error('Link ID and user ID are required');
  }

  return supabaseRequest(env, 'links', 'DELETE', {
    query: {
      id: `eq.${id}`,
      creator_id: `eq.${userId}`,
    },
    prefer: 'return=minimal',
  });
}

// ============================================================
// CLICK STATISTICS
// ============================================================

export async function batchUpsertClickStats(env, rows) {
  if (!rows || rows.length === 0) {
    return;
  }

  return supabaseRequest(
    env,
    'click_statistics',
    'POST',
    {
      body: rows,
      prefer: 'resolution=merge-duplicates,return=minimal',
    }
  );
}

// ============================================================
// DAILY STATISTICS
// ============================================================

export async function batchUpsertDailyStats(env, rows) {
  if (!rows || rows.length === 0) {
    return;
  }

  return supabaseRequest(
    env,
    'daily_statistics',
    'POST',
    {
      body: rows,
      prefer: 'resolution=merge-duplicates,return=minimal',
    }
  );
}

// ============================================================
// D1 CLICK INSERT
// Duplicate event_id is ignored.
// ============================================================

export async function d1RecordClick(env, event) {
  if (!event || !event.shortcode) {
    throw new Error('Invalid click event');
  }

  const eventId = event.event_id || crypto.randomUUID();

  const stmt = env.SHORTUL_DB.prepare(`
    INSERT OR IGNORE INTO click_buffer
      (
        event_id,
        shortcode,
        clicked_at,
        country,
        device_type,
        referrer,
        visitor_hash,
        synced
      )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);

  await stmt.bind(
    eventId,
    event.shortcode,
    event.clicked_at || new Date().toISOString(),
    event.country || null,
    event.device_type || null,
    event.referrer || null,
    event.visitor_hash || null
  ).run();
}

// ============================================================
// D1 READ AGGREGATES
// ============================================================

export async function d1ReadAggregates(env) {
  const stmt = env.SHORTUL_DB.prepare(`
    SELECT
      shortcode,
      DATE(clicked_at) AS click_date,
      strftime('%H', clicked_at) AS click_hour,
      country,
      device_type,
      referrer,
      COUNT(*) AS click_count,
      COUNT(DISTINCT visitor_hash) AS unique_visitors
    FROM click_buffer
    WHERE synced = 0
    GROUP BY
      shortcode,
      click_date,
      click_hour,
      country,
      device_type,
      referrer
    ORDER BY
      click_date ASC,
      click_hour ASC
  `);

  const result = await stmt.all();

  return result.results || [];
}

// ============================================================
// D1 MARK SYNCED
// ============================================================

export async function d1MarkSynced(env) {
  await env.SHORTUL_DB.prepare(`
    UPDATE click_buffer
    SET synced = 1
    WHERE synced = 0
  `).run();
}

// ============================================================
// D1 CLEANUP
// Keep synced rows for 7 days.
// ============================================================

export async function d1CleanupSynced(env) {
  await env.SHORTUL_DB.prepare(`
    DELETE FROM click_buffer
    WHERE synced = 1
      AND clicked_at < datetime('now', '-7 days')
  `).run();
}

// ============================================================
// D1 ADMIN STATS
// ============================================================

export async function d1AdminStats(env) {
  const totalClicks = await env.SHORTUL_DB.prepare(`
    SELECT COUNT(*) AS cnt
    FROM click_buffer
  `).first();

  const todayClicks = await env.SHORTUL_DB.prepare(`
    SELECT COUNT(*) AS cnt
    FROM click_buffer
    WHERE DATE(clicked_at) = DATE('now')
  `).first();

  const topLinks = await env.SHORTUL_DB.prepare(`
    SELECT
      shortcode,
      COUNT(*) AS clicks
    FROM click_buffer
    GROUP BY shortcode
    ORDER BY clicks DESC
    LIMIT 10
  `).all();

  return {
    total_clicks: Number(totalClicks?.cnt || 0),
    today_clicks: Number(todayClicks?.cnt || 0),
    top_links: topLinks.results || [],
  };
}
