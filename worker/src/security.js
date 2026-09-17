// ─────────────────────────────────────────────────────────────
// ShorTul Security
// ─────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────
// SAFE REDIRECT
// ─────────────────────────────────────────────────────────────

export function safeRedirect(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  try {
    const url = new URL(value);

    // ShorTul accepts HTTPS destinations only.
    if (url.protocol !== 'https:') {
      return false;
    }

    // Block local/private development targets.
    if (isBlockedHost(url.hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}


function isBlockedHost(hostname) {
  const host =
    hostname.toLowerCase();

  if (
    host === 'localhost' ||
    host === 'localhost.localdomain' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1'
  ) {
    return true;
  }

  // IPv4 private/local ranges.
  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return true;
  }

  return false;
}


// ─────────────────────────────────────────────────────────────
// HTTPS URL CHECK
// ─────────────────────────────────────────────────────────────

export function isHttpsUrl(value) {
  if (!value) {
    return false;
  }

  try {
    return (
      new URL(value).protocol ===
      'https:'
    );
  } catch {
    return false;
  }
}


// ─────────────────────────────────────────────────────────────
// RATE LIMIT
// ─────────────────────────────────────────────────────────────
//
// NOTE:
// This runs only on redirect requests.
// It uses KV as a lightweight edge limiter.
// ─────────────────────────────────────────────────────────────

export async function rateLimitKey(
  env,
  key,
  limit = 120,
  windowSec = 60
) {
  if (!env.SHORTUL_KV) {
    return {
      ok: true,
    };
  }

  const now =
    Date.now();

  const raw =
    await env.SHORTUL_KV.get(
      key,
      'json'
    );

  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    await env.SHORTUL_KV.put(
      key,
      JSON.stringify({
        count: 1,
        windowStart: now,
      }),
      {
        expirationTtl:
          windowSec + 5,
      }
    );

    return {
      ok: true,
      remaining:
        limit - 1,
    };
  }

  const elapsed =
    now -
    Number(
      raw.windowStart || 0
    );

  // New window.
  if (
    elapsed >=
    windowSec * 1000
  ) {
    await env.SHORTUL_KV.put(
      key,
      JSON.stringify({
        count: 1,
        windowStart: now,
      }),
      {
        expirationTtl:
          windowSec + 5,
      }
    );

    return {
      ok: true,
      remaining:
        limit - 1,
    };
  }

  const count =
    Number(
      raw.count || 0
    );

  if (count >= limit) {
    return {
      ok: false,
      remaining: 0,
    };
  }

  await env.SHORTUL_KV.put(
    key,
    JSON.stringify({
      count: count + 1,
      windowStart:
        raw.windowStart,
    }),
    {
      expirationTtl:
        Math.max(
          1,
          windowSec -
            Math.floor(
              elapsed / 1000
            )
        ) + 5,
    }
  );

  return {
    ok: true,
    remaining:
      limit - count - 1,
  };
}


// ─────────────────────────────────────────────────────────────
// ADMIN AUTH
// ─────────────────────────────────────────────────────────────

export function isAdmin(
  request,
  env
) {
  const configured =
    env.ADMIN_SECRET;

  if (!configured) {
    return false;
  }

  const auth =
    request.headers.get(
      'authorization'
    );

  if (!auth) {
    return false;
  }

  if (
    !auth.startsWith(
      'Bearer '
    )
  ) {
    return false;
  }

  const supplied =
    auth.slice(7).trim();

  if (!supplied) {
    return false;
  }

  return supplied === configured;
}


// ─────────────────────────────────────────────────────────────
// SUPABASE USER AUTHENTICATION
// ─────────────────────────────────────────────────────────────
//
// IMPORTANT:
//
// We do NOT trust the JWT payload directly.
//
// The user's access token is sent to Supabase Auth.
// Supabase validates the token and returns the real user.
//
// This function is used only for authenticated API actions.
// Redirects do NOT call it.
// ─────────────────────────────────────────────────────────────

export async function getAuthUser(
  request,
  env
) {
  const auth =
    request.headers.get(
      'authorization'
    );

  if (!auth) {
    return null;
  }

  if (
    !auth.startsWith(
      'Bearer '
    )
  ) {
    return null;
  }

  const token =
    auth.slice(7).trim();

  if (!token) {
    return null;
  }

  if (!env.SUPABASE_URL) {
    console.error(
      'SUPABASE_URL is not configured'
    );

    return null;
  }

  if (!env.SUPABASE_ANON_KEY) {
    console.error(
      'SUPABASE_ANON_KEY is not configured'
    );

    return null;
  }

  try {
    const response =
      await fetch(
        `${env.SUPABASE_URL}/auth/v1/user`,
        {
          method: 'GET',

          headers: {
            apikey:
              env.SUPABASE_ANON_KEY,

            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    if (!response.ok) {
      return null;
    }

    const user =
      await response.json();

    if (!user?.id) {
      return null;
    }

    return {
      sub: user.id,
      id: user.id,
      email:
        user.email || null,
      role:
        user.role || 'authenticated',
      is_anonymous:
        user.is_anonymous === true,
    };
  } catch (error) {
    console.error(
      'Supabase auth validation failed:',
      error
    );

    return null;
  }
}


// ─────────────────────────────────────────────────────────────
// HTML ESCAPE
// ─────────────────────────────────────────────────────────────

export function escapeHtml(
  value
) {
  return String(
    value ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}
