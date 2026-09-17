// ─────────────────────────────────────────────────────────────
// ShorTul Database Layer
// Supabase = Primary DB
// Cloudflare D1 = Click buffer / analytics staging
// ─────────────────────────────────────────────────────────────

const LINK_SELECT =
  'id,shortcode,destination_url,title,description,is_active,expires_at,password_hash,creator_id,is_guest,permanent,created_at,updated_at';


// ─────────────────────────────────────────────────────────────
// SUPABASE REST
// ─────────────────────────────────────────────────────────────

async function supabaseRequest(
  env,
  table,
  method,
  options = {}
) {
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured'
    );
  }

  const base =
    `${env.SUPABASE_URL}/rest/v1/${table}`;

  let url = base;

  if (options.query) {
    const params = new URLSearchParams(
      options.query
    );

    url = `${base}?${params.toString()}`;
  }

  const headers = {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
    prefer:
      options.prefer ||
      'return=representation',
  };

  const response = await fetch(url, {
    method,
    headers,
    body:
      options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `Supabase ${method} ${table} failed: ${response.status} ${text}`
    );
  }

  if (method === 'DELETE') {
    return null;
  }

  const text =
    await response.text();

  if (!text) {
    return [];
  }

  return JSON.parse(text);
}


// ─────────────────────────────────────────────────────────────
// LINKS
// ─────────────────────────────────────────────────────────────

export async function fetchLinkFromDB(
  env,
  shortcode
) {
  const rows =
    await supabaseRequest(
      env,
      'links',
      'GET',
      {
        query: {
          select: LINK_SELECT,
          shortcode: `eq.${shortcode}`,
          limit: '1',
        },
        prefer: 'return=representation',
      }
    );

  return rows[0] || null;
}


export async function fetchLinkById(
  env,
  id
) {
  const rows =
    await supabaseRequest(
      env,
      'links',
      'GET',
      {
        query: {
          select: LINK_SELECT,
          id: `eq.${id}`,
          limit: '1',
        },
      }
    );

  return rows[0] || null;
}


export async function fetchUserLinkById(
  env,
  id,
  userId
) {
  const rows =
    await supabaseRequest(
      env,
      'links',
      'GET',
      {
        query: {
          select: LINK_SELECT,
          id: `eq.${id}`,
          creator_id: `eq.${userId}`,
          limit: '1',
        },
      }
    );

  return rows[0] || null;
}


export async function fetchAllActiveLinks(
  env
) {
  const rows =
    await supabaseRequest(
      env,
      'links',
      'GET',
      {
        query: {
          select: LINK_SELECT,
          is_active: 'eq.true',
          or:
            '(expires_at.is.null,expires_at.gt.' +
            new Date().toISOString() +
            ')',
        },
      }
    );

  return Array.isArray(rows)
    ? rows
    : [];
}


export async function fetchExpiredLinks(
  env
) {
  const now =
    new Date().toISOString();

  const rows =
    await supabaseRequest(
      env,
      'links',
      'GET',
      {
        query: {
          select:
            'id,shortcode,is_active,expires_at',
          or:
            `(is_active.eq.false,expires_at.lt.${now})`,
          limit: '5000',
        },
      }
    );

  return Array.isArray(rows)
    ? rows
    : [];
}


// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

export async function createLinkInDB(
  env,
  linkData
) {
  return await supabaseRequest(
    env,
    'links',
    'POST',
    {
      body: linkData,
      prefer:
        'return=representation',
    }
  );
}


// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

export async function updateLinkInDB(
  env,
  id,
  updates
) {
  return await supabaseRequest(
    env,
    'links',
    'PATCH',
    {
      query: {
        id: `eq.${id}`,
      },
      body: updates,
      prefer:
        'return=representation',
    }
  );
}


export async function updateUserLinkInDB(
  env,
  id,
  userId,
  updates
) {
  return await supabaseRequest(
    env,
    'links',
    'PATCH',
    {
      query: {
        id: `eq.${id}`,
        creator_id: `eq.${userId}`,
      },
      body: updates,
      prefer:
        'return=representation',
    }
  );
}


// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

export async function deleteLinkFromDB(
  env,
  id
) {
  await supabaseRequest(
    env,
    'links',
    'DELETE',
    {
      query: {
        id: `eq.${id}`,
      },
      prefer:
        'return=minimal',
    }
  );
}


export async function deleteUserLinkFromDB(
  env,
  id,
  userId
) {
  await supabaseRequest(
    env,
    'links',
    'DELETE',
    {
      query: {
        id: `eq.${id}`,
        creator_id: `eq.${userId}`,
      },
      prefer:
        'return=minimal',
    }
  );
}


// ─────────────────────────────────────────────────────────────
// D1 CLICK BUFFER
// ─────────────────────────────────────────────────────────────

export async function d1RecordClick(
  env,
  event
) {
  const eventId =
    event.event_id ||
    crypto.randomUUID();

  const stmt =
    env.SHORTUL_DB.prepare(`
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
    event.clicked_at,
    event.country || null,
    event.device_type || null,
    event.referrer || null,
    event.visitor_hash || null
  ).run();
}


// ─────────────────────────────────────────────────────────────
// SYNC SNAPSHOT
// ─────────────────────────────────────────────────────────────
//
// IMPORTANT:
//
// We first capture MAX(id).
//
// Any click arriving AFTER this point gets a larger ID
// and remains unsynced for the next evening sync.
//
// This prevents click loss.
// ─────────────────────────────────────────────────────────────

export async function d1GetSyncSnapshot(
  env
) {
  const result =
    await env.SHORTUL_DB.prepare(`
      SELECT
        COALESCE(
          MAX(id),
          0
        ) AS max_id
      FROM click_buffer
      WHERE synced = 0
    `).first();

  return {
    maxId: Number(
      result?.max_id || 0
    ),
  };
}


// ─────────────────────────────────────────────────────────────
// HOURLY AGGREGATES
// ─────────────────────────────────────────────────────────────

export async function d1ReadAggregates(
  env,
  maxId
) {
  if (!maxId) {
    return [];
  }

  const result =
    await env.SHORTUL_DB.prepare(`
      SELECT
        shortcode,
        substr(clicked_at, 1, 10) AS date,
        substr(clicked_at, 12, 2) AS hour,
        country,
        device_type,
        referrer,
        COUNT(*) AS clicks,
        COUNT(
          DISTINCT visitor_hash
        ) AS unique_visitors
      FROM click_buffer
      WHERE
        synced = 0
        AND id <= ?
      GROUP BY
        shortcode,
        date,
        hour,
        country,
        device_type,
        referrer
      ORDER BY
        date,
        hour
    `)
    .bind(maxId)
    .all();

  return result?.results || [];
}


// ─────────────────────────────────────────────────────────────
// DAILY UNIQUE VISITORS
// ─────────────────────────────────────────────────────────────
//
// Do NOT calculate daily unique visitors by adding hourly
// unique visitors. The same visitor may appear in multiple
// hours.
//
// This query calculates the real daily DISTINCT count.
// ─────────────────────────────────────────────────────────────

export async function d1ReadDailyUnique(
  env,
  maxId
) {
  if (!maxId) {
    return [];
  }

  const result =
    await env.SHORTUL_DB.prepare(`
      SELECT
        shortcode,
        substr(clicked_at, 1, 10) AS date,
        COUNT(
          DISTINCT visitor_hash
        ) AS unique_visitors
      FROM click_buffer
      WHERE
        synced = 0
        AND id <= ?
        AND visitor_hash IS NOT NULL
      GROUP BY
        shortcode,
        date
      ORDER BY
        date
    `)
    .bind(maxId)
    .all();

  return result?.results || [];
}


// ─────────────────────────────────────────────────────────────
// MARK SYNCED
// ─────────────────────────────────────────────────────────────
//
// ONLY rows inside the captured snapshot are marked synced.
// New clicks remain untouched.
// ─────────────────────────────────────────────────────────────

export async function d1MarkSynced(
  env,
  maxId
) {
  if (!maxId) {
    return;
  }

  await env.SHORTUL_DB.prepare(`
    UPDATE click_buffer
    SET synced = 1
    WHERE
      synced = 0
      AND id <= ?
  `)
    .bind(maxId)
    .run();
}


// ─────────────────────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────────────────────

export async function d1CleanupSynced(
  env
) {
  await env.SHORTUL_DB.prepare(`
    DELETE FROM click_buffer
    WHERE
      synced = 1
      AND clicked_at <
        datetime('now', '-7 days')
  `).run();
}


// ─────────────────────────────────────────────────────────────
// SUPABASE CLICK STATISTICS
// ─────────────────────────────────────────────────────────────

export async function batchUpsertClickStats(
  env,
  rows
) {
  if (!rows?.length) {
    return;
  }

  await supabaseRequest(
    env,
    'click_statistics',
    'POST',
    {
      body: rows,
      prefer:
        'resolution=merge-duplicates,return=minimal',
    }
  );
}


// ─────────────────────────────────────────────────────────────
// SUPABASE DAILY STATISTICS
// ─────────────────────────────────────────────────────────────

export async function batchUpsertDailyStats(
  env,
  rows
) {
  if (!rows?.length) {
    return;
  }

  await supabaseRequest(
    env,
    'daily_statistics',
    'POST',
    {
      body: rows,
      prefer:
        'resolution=merge-duplicates,return=minimal',
    }
  );
}


// ─────────────────────────────────────────────────────────────
// ADMIN STATS
// ─────────────────────────────────────────────────────────────

export async function d1AdminStats(
  env
) {
  const total =
    await env.SHORTUL_DB.prepare(`
      SELECT COUNT(*) AS total
      FROM click_buffer
    `).first();

  const today =
    await env.SHORTUL_DB.prepare(`
      SELECT COUNT(*) AS total
      FROM click_buffer
      WHERE substr(clicked_at, 1, 10)
        = date('now')
    `).first();

  const top =
    await env.SHORTUL_DB.prepare(`
      SELECT
        shortcode,
        COUNT(*) AS clicks
      FROM click_buffer
      GROUP BY shortcode
      ORDER BY clicks DESC
      LIMIT 20
    `).all();

  return {
    total_clicks: Number(
      total?.total || 0
    ),

    today_clicks: Number(
      today?.total || 0
    ),

    top_links:
      top?.results || [],
  };
}
