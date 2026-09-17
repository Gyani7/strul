// ── Security utilities ─────────────────────────────────────────

const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'data:',
  'file:',
  'vbscript:',
  'about:',
];

export function safeRedirect(url) {
  if (!url || typeof url !== 'string') return false;

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Production: HTTPS only.
  // HTTP is allowed only for non-production localhost development.
  if (parsed.protocol !== 'https:') {
    if (
      parsed.protocol !== 'http:' ||
      !isLocalDevelopmentHost(parsed.hostname)
    ) {
      return false;
    }
  }

  if (DANGEROUS_PROTOCOLS.includes(parsed.protocol)) {
    return false;
  }

  // Never allow local/private development targets in production.
  if (isLocalDevelopmentHost(parsed.hostname)) {
    return false;
  }

  return true;
}

function isLocalDevelopmentHost(hostname) {
  const host = String(hostname || '').toLowerCase();

  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1'
  );
}

export function isHttpsUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ── Simple KV rate limiter ────────────────────────────────────
// Kept compatible with the current Worker architecture.
// Redirect optimization will avoid making this unnecessarily
// expensive for every normal KV-hit redirect.

export async function rateLimitKey(env, key, windowSec, maxReq) {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / windowSec);
  const fullKey = `${key}:${windowKey}`;

  try {
    const current = Number(
      await env.SHORTUL_KV.get(fullKey) || '0'
    );

    if (current >= maxReq) {
      return { ok: false };
    }

    await env.SHORTUL_KV.put(
      fullKey,
      String(current + 1),
      {
        expirationTtl: windowSec + 5,
      }
    );

    return { ok: true };
  } catch {
    // Never break a valid redirect because rate limiting failed.
    return { ok: true };
  }
}

// ── HTML escaping ──────────────────────────────────────────────

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';

  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Admin authentication ──────────────────────────────────────

export function isAdmin(request, env) {
  const auth = request.headers.get('authorization');

  if (!auth || !auth.startsWith('Bearer ')) {
    return false;
  }

  const token = auth.slice(7).trim();

  if (!token || !env.ADMIN_SECRET) {
    return false;
  }

  return token === env.ADMIN_SECRET;
}

// ── Supabase JWT payload extraction ────────────────────────────
// IMPORTANT:
// This function only decodes the JWT payload.
// It does NOT cryptographically verify the Supabase token.
//
// Therefore API routes must not treat this as complete JWT
// verification until Supabase JWT verification is configured.

export function getAuthUser(request) {
  const auth = request.headers.get('authorization');

  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }

  const token = auth.slice(7).trim();

  if (!token) {
    return null;
  }

  try {
    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    const payload = decodeJwtPayload(parts[1]);

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    if (!payload.sub || typeof payload.sub !== 'string') {
      return null;
    }

    return {
      ...payload,
      _token: token,
    };
  } catch {
    return null;
  }
}

// ── JWT payload decoder ───────────────────────────────────────

function decodeJwtPayload(encoded) {
  // JWT uses base64url, not normal base64.
  const normalized = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const padded =
    normalized + '='.repeat((4 - normalized.length % 4) % 4);

  const binary = atob(padded);

  const bytes = Uint8Array.from(
    binary,
    char => char.charCodeAt(0)
  );

  const json = new TextDecoder().decode(bytes);

  return JSON.parse(json);
}
