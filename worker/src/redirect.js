// ─────────────────────────────────────────────────────────────
// ShorTul Redirect Engine
// KV-first, DB fallback, async analytics
// ─────────────────────────────────────────────────────────────

import {
  isValidShortcode,
} from './shortcode.js';

import {
  safeRedirect,
  rateLimitKey,
} from './security.js';

import {
  fetchLinkFromDB,
} from './db.js';

import {
  recordClickAsync,
} from './queue.js';

import {
  notFoundPage,
} from './404.js';


// ─────────────────────────────────────────────────────────────
// REDIRECT
// ─────────────────────────────────────────────────────────────

export async function handleRedirect(
  request,
  env,
  ctx,
  shortcode
) {
  const start =
    Date.now();

  // Only GET / HEAD should be redirect requests.
  if (
    request.method !== 'GET' &&
    request.method !== 'HEAD'
  ) {
    return new Response(
      'Method Not Allowed',
      {
        status: 405,
        headers: {
          allow: 'GET, HEAD',
        },
      }
    );
  }

  // ─────────────────────────────────────────────
  // SHORTCODE VALIDATION
  // ─────────────────────────────────────────────

  if (
    !isValidShortcode(
      shortcode
    )
  ) {
    return notFound(env);
  }

  // ─────────────────────────────────────────────
  // EDGE RATE LIMIT
  // ─────────────────────────────────────────────

  const ip =
    request.headers.get(
      'cf-connecting-ip'
    ) || 'unknown';

  try {
    const rate =
      await rateLimitKey(
        env,
        `rl:${ip}`,
        120,
        60
      );

    if (!rate.ok) {
      return new Response(
        'Too many requests',
        {
          status: 429,
          headers: {
            'retry-after': '60',
          },
        }
      );
    }
  } catch {
    // If rate limiting has a temporary KV issue,
    // do not break legitimate redirects.
  }

  // ─────────────────────────────────────────────
  // KV LOOKUP
  // ─────────────────────────────────────────────

  let record = null;
  let cacheHit = false;

  try {
    const raw =
      await env.SHORTUL_KV.get(
        `link:${shortcode}`,
        'json'
      );

    if (raw) {
      record = raw;
      cacheHit = true;
    }
  } catch (error) {
    console.error(
      'KV lookup failed:',
      error
    );
  }

  // ─────────────────────────────────────────────
  // DB FALLBACK
  // ─────────────────────────────────────────────

  if (!record) {
    try {
      record =
        await fetchLinkFromDB(
          env,
          shortcode
        );
    } catch (error) {
      console.error(
        'DB fallback failed:',
        error
      );

      return notFound(env);
    }

    if (!record) {
      return notFound(env);
    }

    // Populate KV after DB miss.
    try {
      await cacheLink(
        env,
        record
      );
    } catch (error) {
      console.error(
        'KV populate failed:',
        error
      );
    }
  }

  // ─────────────────────────────────────────────
  // ACTIVE CHECK
  // ─────────────────────────────────────────────

  if (!record.is_active) {
    try {
      if (cacheHit) {
        await env.SHORTUL_KV.delete(
          `link:${shortcode}`
        );
      }
    } catch {}

    return notFound(env);
  }

  // ─────────────────────────────────────────────
  // EXPIRY CHECK
  // ─────────────────────────────────────────────

  if (
    record.expires_at
  ) {
    const expiry =
      new Date(
        record.expires_at
      ).getTime();

    if (
      !Number.isFinite(expiry) ||
      expiry <= Date.now()
    ) {
      try {
        await env.SHORTUL_KV.delete(
          `link:${shortcode}`
        );
      } catch {}

      return notFound(env);
    }
  }

  // ─────────────────────────────────────────────
  // PASSWORD PROTECTION
  // ─────────────────────────────────────────────

  if (
    record.password_hash
  ) {
    const auth =
      request.headers.get(
        'authorization'
      );

    if (
      !auth ||
      !await verifyPassword(
        auth,
        record.password_hash
      )
    ) {
      return new Response(
        'Authentication required',
        {
          status: 401,

          headers: {
            'www-authenticate':
              'Basic realm="ShorTul"',
          },
        }
      );
    }
  }

  // ─────────────────────────────────────────────
  // DESTINATION SECURITY
  // ─────────────────────────────────────────────

  if (
    !safeRedirect(
      record.destination_url
    )
  ) {
    return new Response(
      'Invalid destination',
      {
        status: 400,
      }
    );
  }

  // ─────────────────────────────────────────────
  // ASYNC CLICK TRACKING
  // ─────────────────────────────────────────────
  //
  // IMPORTANT:
  // Redirect does not await analytics.
  //
  // Queue → D1 happens in the background.
  // ─────────────────────────────────────────────

  try {
    ctx.waitUntil(
      recordClickAsync(
        env,
        ctx,
        request,
        shortcode,
        record
      )
    );
  } catch {
    // Analytics failure must never stop redirect.
  }

  // ─────────────────────────────────────────────
  // REDIRECT
  // ─────────────────────────────────────────────

  const status =
    record.permanent === false
      ? 302
      : 301;

  return new Response(
    null,
    {
      status,

      headers: {
        location:
          record.destination_url,

        // Do not allow browsers/CDN to cache the
        // redirect aggressively because that can
        // reduce observable click events.
        'cache-control':
          'no-store',

        'x-shortul-cache':
          cacheHit
            ? 'HIT'
            : 'MISS',

        'x-shortul-ms':
          String(
            Date.now() -
            start
          ),
      },
    }
  );
}


// ─────────────────────────────────────────────────────────────
// KV CACHE
// ─────────────────────────────────────────────────────────────

async function cacheLink(
  env,
  link
) {
  if (
    !link?.shortcode ||
    !link?.destination_url
  ) {
    return;
  }

  const record = {
    id:
      link.id || null,

    shortcode:
      link.shortcode,

    destination_url:
      link.destination_url,

    is_active:
      link.is_active !== false,

    expires_at:
      link.expires_at || null,

    password_hash:
      link.password_hash || null,

    permanent:
      link.permanent !== false,
  };

  // Expiring link.
  if (
    link.expires_at
  ) {
    const expiry =
      new Date(
        link.expires_at
      ).getTime();

    const ttl =
      Math.max(
        60,
        Math.floor(
          (expiry -
            Date.now()) /
            1000
        )
      );

    await env.SHORTUL_KV.put(
      `link:${link.shortcode}`,
      JSON.stringify(record),
      {
        expirationTtl:
          ttl,
      }
    );

    return;
  }

  // Permanent link.
  await env.SHORTUL_KV.put(
    `link:${link.shortcode}`,
    JSON.stringify(record)
  );
}


// ─────────────────────────────────────────────────────────────
// PASSWORD VERIFY
// ─────────────────────────────────────────────────────────────

async function verifyPassword(
  authHeader,
  passwordHash
) {
  try {
    if (
      !authHeader.startsWith(
        'Basic '
      )
    ) {
      return false;
    }

    const encoded =
      authHeader
        .slice(6)
        .trim();

    const decoded =
      atob(encoded);

    const separator =
      decoded.indexOf(':');

    if (
      separator === -1
    ) {
      return false;
    }

    const password =
      decoded.slice(
        separator + 1
      );

    const hash =
      await sha256(
        password
      );

    return (
      hash ===
      passwordHash
    );
  } catch {
    return false;
  }
}


// ─────────────────────────────────────────────────────────────
// SHA-256
// ─────────────────────────────────────────────────────────────

async function sha256(
  text
) {
  const data =
    new TextEncoder().encode(
      text
    );

  const buffer =
    await crypto.subtle.digest(
      'SHA-256',
      data
    );

  return [...new Uint8Array(buffer)]
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(2, '0')
    )
    .join('');
}


// ─────────────────────────────────────────────────────────────
// 404
// ─────────────────────────────────────────────────────────────

function notFound(
  env
) {
  return new Response(
    notFoundPage(env),
    {
      status: 404,

      headers: {
        'content-type':
          'text/html;charset=utf-8',

        'cache-control':
          'no-store',
      },
    }
  );
}
