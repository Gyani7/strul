// ── Click tracking: async event → Queue → D1 ─────────────────

export async function recordClickAsync(
  env,
  ctx,
  request,
  shortcode,
  record
) {
  const cf = request.cf || {};
  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || '';

  const event = {
    event_id: crypto.randomUUID(),

    shortcode,

    clicked_at: new Date().toISOString(),

    country: cf.country || null,

    device_type: detectDevice(ua),

    referrer: request.headers.get('referer') || null,

    visitor_hash: await hashVisitor(ip, ua),
  };

  // Preferred path:
  // Redirect request does NOT wait for analytics.
  if (env.CLICK_QUEUE) {
    try {
      await env.CLICK_QUEUE.send(event);
      return;
    } catch {
      // Queue unavailable → fallback to D1.
    }
  }

  // Fallback path.
  // Caller already executes this through ctx.waitUntil().
  try {
    await d1RecordClickFallback(env, event);
  } catch {
    // Redirect integrity is more important than analytics.
    // If both Queue and D1 fail, the click may be lost.
  }
}

// ── Device detection ──────────────────────────────────────────

function detectDevice(ua) {
  if (/tablet|kindle|silk/i.test(ua)) {
    return 'tablet';
  }

  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

// ── Visitor hash ───────────────────────────────────────────────

async function hashVisitor(ip, ua) {
  const text = `${ip}:${ua}`;

  const data = new TextEncoder().encode(text);

  const buffer = await crypto.subtle.digest(
    'SHA-256',
    data
  );

  // Store only the first 8 bytes.
  return [...new Uint8Array(buffer)]
    .slice(0, 8)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

// ── D1 fallback ────────────────────────────────────────────────
// Kept here to avoid importing the old queue/D1 implementation
// and creating a circular dependency.

async function d1RecordClickFallback(env, event) {
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
    event.event_id,
    event.shortcode,
    event.clicked_at,
    event.country,
    event.device_type,
    event.referrer,
    event.visitor_hash
  ).run();
}
