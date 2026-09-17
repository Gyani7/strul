// ── Click tracking: async event → queue → D1 aggregation ──────

import { d1RecordClick } from './db.js';

export async function recordClickAsync(env, ctx, request, shortcode, record) {
  const cf = request.cf || {};
  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || '';

  const event = {
    shortcode,
    clicked_at: new Date().toISOString(),
    country: cf.country || null,
    device_type: detectDevice(ua),
    referrer: request.headers.get('referer') || null,
    visitor_hash: await hashVisitor(ip, ua),
  };

  // Send to Queue (preferred) — non-blocking
  if (env.CLICK_QUEUE) {
    try {
      await env.CLICK_QUEUE.send(event);
      return;
    } catch {
      // Queue failed — fallback to direct D1 write
    }
  }

  // Fallback: write directly to D1 (still async via waitUntil)
  try {
    await d1RecordClick(env, event);
  } catch {
    // If both queue and D1 fail, the redirect already succeeded.
    // Click is lost but redirect integrity is preserved.
  }
}

function detectDevice(ua) {
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) return 'mobile';
  if (/tablet|kindle|silk/i.test(ua)) return 'tablet';
  return 'desktop';
}

async function hashVisitor(ip, ua) {
  // Hash IP+UA for uniqueness — never store raw IP
  const text = `${ip}:${ua}`;
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}
