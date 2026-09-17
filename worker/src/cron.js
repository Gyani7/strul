// ── Scheduled jobs: morning preload + evening sync ────────────

import {
  fetchAllActiveLinks,
  fetchExpiredLinks,
  d1ReadAggregates,
  d1MarkSynced,
  d1CleanupSynced,
  batchUpsertClickStats,
  batchUpsertDailyStats,
} from './db.js';

export async function handleScheduled(event, env, ctx) {
  const hourUTC = new Date(event.scheduledTime).getUTCHours();

  if (hourUTC < 12) {
    // Morning (06:00 UTC) — cache preload
    await morningPreload(env);
  } else {
    // Evening (22:00 UTC) — click sync
    await eveningSync(env);
  }
}

// ── MORNING: preload all active links into KV ──
async function morningPreload(env) {
  const links = await fetchAllActiveLinks(env);
  const now = Date.now();

  // Write all active links to KV
  const writes = links.map((link) => {
    const ttl = link.expires_at
      ? Math.max(60, Math.floor((new Date(link.expires_at).getTime() - now) / 1000))
      : 86400; // 1 day

    const record = {
      id: link.id,
      shortcode: link.shortcode,
      destination_url: link.destination_url,
      is_active: link.is_active,
      expires_at: link.expires_at,
      password_hash: link.password_hash,
      permanent: link.permanent !== false,
    };

    return env.SHORTUL_KV.put(`link:${link.shortcode}`, JSON.stringify(record), {
      expirationTtl: ttl,
    });
  });

  // Batch in chunks of 50 to avoid overwhelming KV
  const CHUNK = 50;
  for (let i = 0; i < writes.length; i += CHUNK) {
    await Promise.allSettled(writes.slice(i, i + CHUNK));
  }

  // Remove expired/inactive records from KV
  const expired = await fetchExpiredLinks(env);
  const deletes = expired.map((l) => env.SHORTUL_KV.delete(`link:${l.shortcode}`));
  for (let i = 0; i < deletes.length; i += CHUNK) {
    await Promise.allSettled(deletes.slice(i, i + CHUNK));
  }
}

// ── EVENING: sync aggregated clicks to Supabase ──
async function eveningSync(env) {
  // 1. Read aggregated click data from D1
  const aggregates = await d1ReadAggregates(env);
  if (!aggregates || aggregates.length === 0) {
    await d1CleanupSynced(env);
    return;
  }

  // 2. Build click_statistics rows (per shortcode/date/hour/country/device/referrer)
  const clickRows = aggregates.map((a) => ({
    shortcode: a.shortcode,
    click_date: a.click_date,
    click_hour: parseInt(a.click_hour, 10),
    country: a.country,
    device_type: a.device_type,
    referrer: a.referrer,
    click_count: a.click_count,
    unique_visitors: a.unique_visitors,
  }));

  // 3. Build daily_statistics rows (rolled up by shortcode/date)
  const dailyMap = new Map();
  for (const a of aggregates) {
    const key = `${a.shortcode}:${a.click_date}`;
    if (!dailyMap.has(key)) {
      dailyMap.set(key, {
        shortcode: a.shortcode,
        click_date: a.click_date,
        total_clicks: 0,
        unique_visitors: 0,
      });
    }
    const d = dailyMap.get(key);
    d.total_clicks += a.click_count;
    d.unique_visitors += a.unique_visitors;
  }
  const dailyRows = [...dailyMap.values()];

  // 4. Batch upsert to Supabase (in chunks of 500)
  const CHUNK = 500;
  let syncSuccess = true;

  for (let i = 0; i < clickRows.length; i += CHUNK) {
    try {
      await batchUpsertClickStats(env, clickRows.slice(i, i + CHUNK));
    } catch (e) {
      syncSuccess = false;
      // Don't mark as synced — retry next run
      break;
    }
  }

  if (syncSuccess) {
    for (let i = 0; i < dailyRows.length; i += CHUNK) {
      try {
        await batchUpsertDailyStats(env, dailyRows.slice(i, i + CHUNK));
      } catch (e) {
        syncSuccess = false;
        break;
      }
    }
  }

  // 5. Only mark synced if both upserts succeeded — no clicks lost on failure
  if (syncSuccess) {
    await d1MarkSynced(env);
  }

  // 6. Cleanup old synced rows
  await d1CleanupSynced(env);
}
