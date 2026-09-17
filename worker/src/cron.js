// ─────────────────────────────────────────────────────────────
// ShorTul Cron
//
// 06:00 IST → Active links → KV preload
// 22:00 IST → D1 click aggregates → Supabase
// ─────────────────────────────────────────────────────────────

import {
  fetchAllActiveLinks,
  fetchExpiredLinks,
  d1GetSyncSnapshot,
  d1ReadAggregates,
  d1ReadDailyUnique,
  d1MarkSynced,
  d1CleanupSynced,
  batchUpsertClickStats,
  batchUpsertDailyStats,
} from './db.js';

const KV_BATCH_SIZE = 50;
const DB_BATCH_SIZE = 500;

// 06:00 IST / 22:00 IST
export async function handleScheduled(event, env, ctx) {
  const scheduled = new Date(event.scheduledTime || Date.now());
  const hourUTC = scheduled.getUTCHours();

  // 00:30 UTC = 06:00 IST
  if (hourUTC < 12) {
    await morningPreload(env);
    return;
  }

  // 16:30 UTC = 22:00 IST
  await eveningSync(env);
}

// ─────────────────────────────────────────────────────────────
// MORNING
// ─────────────────────────────────────────────────────────────

async function morningPreload(env) {
  console.log('ShorTul morning preload started');

  const links = await fetchAllActiveLinks(env);

  let loaded = 0;
  let failed = 0;

  // Write KV in small groups.
  for (let i = 0; i < links.length; i += KV_BATCH_SIZE) {
    const chunk = links.slice(i, i + KV_BATCH_SIZE);

    const results = await Promise.allSettled(
      chunk.map(link => preloadLink(env, link))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        loaded++;
      } else {
        failed++;
        console.error(
          'KV preload failed:',
          result.reason
        );
      }
    }
  }

  // Remove expired/inactive links from KV.
  let deleted = 0;

  try {
    const expired = await fetchExpiredLinks(env);

    for (let i = 0; i < expired.length; i += KV_BATCH_SIZE) {
      const chunk = expired.slice(i, i + KV_BATCH_SIZE);

      const results = await Promise.allSettled(
        chunk.map(async link => {
          await env.SHORTUL_KV.delete(
            `link:${link.shortcode}`
          );
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          deleted++;
        }
      }
    }
  } catch (error) {
    console.error(
      'Expired-link cleanup failed:',
      error
    );
  }

  console.log(
    JSON.stringify({
      job: 'morning_preload',
      loaded,
      failed,
      deleted,
      total: links.length,
      finished_at: new Date().toISOString(),
    })
  );
}

// ─────────────────────────────────────────────────────────────
// KV LINK
// ─────────────────────────────────────────────────────────────

async function preloadLink(env, link) {
  if (!link?.shortcode) {
    throw new Error('Invalid link shortcode');
  }

  if (!link.is_active) {
    await env.SHORTUL_KV.delete(
      `link:${link.shortcode}`
    );
    return;
  }

  if (
    link.expires_at &&
    new Date(link.expires_at).getTime() <= Date.now()
  ) {
    await env.SHORTUL_KV.delete(
      `link:${link.shortcode}`
    );
    return;
  }

  const record = {
    id: link.id,
    shortcode: link.shortcode,
    destination_url: link.destination_url,
    is_active: link.is_active,
    expires_at: link.expires_at || null,
    password_hash: link.password_hash || null,
    permanent: link.permanent !== false,
  };

  // Expiring links get an exact KV TTL.
  if (link.expires_at) {
    const ttl = Math.max(
      60,
      Math.floor(
        (
          new Date(link.expires_at).getTime() -
          Date.now()
        ) / 1000
      )
    );

    await env.SHORTUL_KV.put(
      `link:${link.shortcode}`,
      JSON.stringify(record),
      {
        expirationTtl: ttl,
      }
    );

    return;
  }

  // Permanent links stay in KV until explicitly
  // updated/deleted or reconciled by the next preload.
  await env.SHORTUL_KV.put(
    `link:${link.shortcode}`,
    JSON.stringify(record)
  );
}

// ─────────────────────────────────────────────────────────────
// EVENING
// ─────────────────────────────────────────────────────────────

async function eveningSync(env) {
  console.log('ShorTul evening sync started');

  let snapshot;

  try {
    // IMPORTANT:
    // Capture the highest click-buffer ID first.
    // New clicks arriving after this point stay unsynced
    // for the next sync instead of being lost.
    snapshot = await d1GetSyncSnapshot(env);
  } catch (error) {
    console.error(
      'Could not create D1 sync snapshot:',
      error
    );
    return;
  }

  if (!snapshot || !snapshot.maxId) {
    console.log('No clicks waiting for sync');

    await safeCleanup(env);
    return;
  }

  const maxId = snapshot.maxId;

  let aggregates;
  let dailyUnique;

  try {
    aggregates = await d1ReadAggregates(
      env,
      maxId
    );

    dailyUnique = await d1ReadDailyUnique(
      env,
      maxId
    );
  } catch (error) {
    console.error(
      'D1 aggregate read failed:',
      error
    );
    return;
  }

  if (!aggregates.length) {
    console.log('No aggregate rows found');
    return;
  }

  // ───────────────────────────────────────────────
  // CLICK STATISTICS
  // ───────────────────────────────────────────────

  const clickRows = aggregates.map(row => ({
    shortcode: row.shortcode,
    date: row.date,
    hour: row.hour,
    country: row.country,
    device_type: row.device_type,
    referrer: row.referrer,
    clicks: Number(row.clicks || 0),
    unique_visitors: Number(
      row.unique_visitors || 0
    ),
  }));

  // ───────────────────────────────────────────────
  // DAILY STATISTICS
  // ───────────────────────────────────────────────

  const dailyMap = new Map();

  for (const row of aggregates) {
    const key = `${row.shortcode}:${row.date}`;

    if (!dailyMap.has(key)) {
      dailyMap.set(key, {
        shortcode: row.shortcode,
        date: row.date,
        clicks: 0,
      });
    }

    dailyMap.get(key).clicks += Number(
      row.clicks || 0
    );
  }

  // Use a separate DISTINCT calculation for daily
  // visitors. We do NOT sum hourly unique visitors.
  for (const row of dailyUnique) {
    const key = `${row.shortcode}:${row.date}`;

    const daily = dailyMap.get(key);

    if (daily) {
      daily.unique_visitors = Number(
        row.unique_visitors || 0
      );
    }
  }

  const dailyRows = [...dailyMap.values()].map(
    row => ({
      shortcode: row.shortcode,
      date: row.date,
      clicks: row.clicks,
      unique_visitors: row.unique_visitors || 0,
    })
  );

  // ───────────────────────────────────────────────
  // SUPABASE CLICK STATS
  // ───────────────────────────────────────────────

  try {
    await upsertInChunks(
      clickRows,
      DB_BATCH_SIZE,
      batchUpsertClickStats
    );
  } catch (error) {
    console.error(
      'Click statistics sync failed:',
      error
    );

    // IMPORTANT:
    // Do NOT mark D1 rows synced if Supabase
    // write failed.
    return;
  }

  // ───────────────────────────────────────────────
  // SUPABASE DAILY STATS
  // ───────────────────────────────────────────────

  try {
    await upsertInChunks(
      dailyRows,
      DB_BATCH_SIZE,
      batchUpsertDailyStats
    );
  } catch (error) {
    console.error(
      'Daily statistics sync failed:',
      error
    );

    // Do not mark synced.
    // Next run can safely retry.
    return;
  }

  // ───────────────────────────────────────────────
  // MARK ONLY THE SNAPSHOT AS SYNCED
  // ───────────────────────────────────────────────

  try {
    await d1MarkSynced(env, maxId);
  } catch (error) {
    console.error(
      'D1 mark-synced failed:',
      error
    );
    return;
  }

  await safeCleanup(env);

  console.log(
    JSON.stringify({
      job: 'evening_sync',
      max_id: maxId,
      click_rows: clickRows.length,
      daily_rows: dailyRows.length,
      finished_at: new Date().toISOString(),
    })
  );
}

// ─────────────────────────────────────────────────────────────
// CHUNKED UPSERT
// ─────────────────────────────────────────────────────────────

async function upsertInChunks(
  rows,
  chunkSize,
  upsertFunction
) {
  for (
    let i = 0;
    i < rows.length;
    i += chunkSize
  ) {
    const chunk = rows.slice(
      i,
      i + chunkSize
    );

    await upsertFunction(
      chunk
    );
  }
}

// ─────────────────────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────────────────────

async function safeCleanup(env) {
  try {
    await d1CleanupSynced(env);
  } catch (error) {
    console.error(
      'D1 cleanup failed:',
      error
    );
  }
}
