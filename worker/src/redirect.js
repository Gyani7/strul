// ── KV-first redirect logic ────────────────────────────────────
// NEVER queries Supabase when shortcode exists in KV.
// Cache-miss → DB → populate KV → redirect.

import { isValidShortcode } from './shortcode.js';
import { safeRedirect, rateLimitKey } from './security.js';
import { fetchLinkFromDB } from './db.js';
import { recordClickAsync } from './queue.js';
import { notFoundPage } from './404.js';

export async function handleRedirect(request, env, ctx, shortcode) {
  const start = Date.now();

  // Reject obviously invalid shortcodes fast (no DB lookup)
  if (!isValidShortcode(shortcode)) {
    return notFound(env);
  }

  // ── Rate limiting (basic, per-IP) ──
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const rl = await rateLimitKey(env, `rl:${ip}`, 60, 120); // 120 req/min
  if (!rl.ok) {
    return new Response('Too many requests', { status: 429 });
  }

  // ── 1. Check KV (fast path) ──
  let record = null;
  try {
    const raw = await env.SHORTUL_KV.get(`link:${shortcode}`, 'json');
    if (raw) record = raw;
  } catch (e) {
    // KV unavailable — fall through to DB
  }

  // ── 2. Cache miss → query primary DB ──
  if (!record) {
    try {
      record = await fetchLinkFromDB(env, shortcode);
    } catch (e) {
      // DB also unavailable — return 404 (can't verify)
      return notFound(env);
    }

    if (!record) {
      return notFound(env);
    }

    // Populate KV for future requests
    try {
      const ttl = record.expires_at
        ? Math.max(60, Math.floor((new Date(record.expires_at).getTime() - Date.now()) / 1000))
        : 86400; // 1 day default
      await env.SHORTUL_KV.put(`link:${shortcode}`, JSON.stringify(record), {
        expirationTtl: ttl,
      });
    } catch (e) {
      // KV write failure is non-fatal; redirect still proceeds
    }
  }

  // ── 3. Validate record state ──
  if (!record.is_active) {
    return notFound(env);
  }
  if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
    // Invalidate stale KV entry
    try { await env.SHORTUL_KV.delete(`link:${shortcode}`); } catch {}
    return notFound(env);
  }

  // ── 4. Password-protected link ──
  if (record.password_hash) {
    const auth = request.headers.get('authorization');
    if (!auth || !await verifyPassword(auth, record.password_hash)) {
      return new Response('Authentication required', {
        status: 401,
        headers: { 'www-authenticate': 'Basic realm="ShorTul"' },
      });
    }
  }

  // ── 5. Validate destination URL ──
  if (!safeRedirect(record.destination_url)) {
    return new Response('Invalid destination', { status: 400 });
  }

  // ── 6. Record click ASYNCHRONOUSLY (never block redirect) ──
  ctx.waitUntil(recordClickAsync(env, ctx, request, shortcode, record));

  // ── 7. Return redirect immediately ──
  const status = record.permanent === false ? 302 : 301;
  return new Response(null, {
    status,
    headers: {
      'location': record.destination_url,
      'cache-control': 'public, max-age=60',
      'x-shortul-cache': record._fromKV ? 'HIT' : 'MISS',
      'x-shortul-ms': String(Date.now() - start),
    },
  });
}

async function verifyPassword(authHeader, passwordHash) {
  // Basic auth: "Basic base64(user:pass)"
  try {
    const encoded = authHeader.split(' ')[1];
    const decoded = atob(encoded);
    const [, pass] = decoded.split(':');
    // Simple hash compare (Supabase stores bcrypt; for KV we store a sha256)
    const hash = await sha256(pass);
    return hash === passwordHash;
  } catch {
    return false;
  }
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function notFound(env) {
  return new Response(notFoundPage(env), {
    status: 404,
    headers: { 'content-type': 'text/html;charset=utf-8' },
  });
}
