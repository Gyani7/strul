// ── Security utilities ─────────────────────────────────────────

const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:'];

export function safeRedirect(url) {
  if (!url || typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // HTTPS only (allow http for localhost dev)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  if (DANGEROUS_PROTOCOLS.includes(parsed.protocol)) return false;
  // Block localhost in production
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    return false;
  }
  return true;
}

export function isHttpsUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Simple in-KV rate limiter
// limit per key: max requests per window seconds
export async function rateLimitKey(env, key, windowSec, maxReq) {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / windowSec);
  const fullKey = `${key}:${windowKey}`;

  try {
    const current = parseInt(await env.SHORTUL_KV.get(fullKey) || '0', 10);
    if (current >= maxReq) {
      return { ok: false };
    }
    await env.SHORTUL_KV.put(fullKey, String(current + 1), {
      expirationTtl: windowSec,
    });
    return { ok: true };
  } catch {
    // If KV fails, allow the request (don't block redirects on RL failure)
    return { ok: true };
  }
}

// HTML escape for any user content rendered in pages
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Verify admin token
export function isAdmin(request, env) {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return false;
  return auth.slice(7) === env.ADMIN_SECRET;
}

// Verify Supabase JWT (basic check — Supabase validates server-side)
export function getAuthUser(request) {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const token = auth.slice(7);
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub ? payload : null;
  } catch {
    return null;
  }
}
