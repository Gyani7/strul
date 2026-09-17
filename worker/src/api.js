// ─────────────────────────────────────────────────────────────
// ShorTul API
// ─────────────────────────────────────────────────────────────

import {
  validateAlias,
  generateUniqueShortcode,
} from './shortcode.js';

import {
  safeRedirect,
  isAdmin,
  getAuthUser,
} from './security.js';

import {
  createLinkInDB,
  updateUserLinkInDB,
  deleteUserLinkFromDB,
  fetchLinkFromDB,
  fetchUserLinkById,
  fetchLinkById,
  d1AdminStats,
} from './db.js';


// ─────────────────────────────────────────────────────────────
// MAIN API ROUTER
// ─────────────────────────────────────────────────────────────

export async function handleApi(
  request,
  env,
  ctx
) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') {
    return corsResponse(env);
  }

  // Health
  if (
    path === '/api/health' &&
    method === 'GET'
  ) {
    return jsonResponse({
      ok: true,
      ts: Date.now(),
    });
  }

  // Create short link
  if (
    path === '/api/shorten' &&
    method === 'POST'
  ) {
    return handleShorten(
      request,
      env,
      ctx
    );
  }

  // Admin API
  if (path.startsWith('/api/admin')) {
    if (!isAdmin(request, env)) {
      return jsonResponse(
        { error: 'Unauthorized' },
        401
      );
    }

    return handleAdmin(
      request,
      env,
      path,
      method
    );
  }

  // User link API
  if (path.startsWith('/api/links')) {
    return handleLinks(
      request,
      env,
      path,
      method
    );
  }

  return jsonResponse(
    { error: 'Not found' },
    404
  );
}


// ─────────────────────────────────────────────────────────────
// CREATE LINK
// ─────────────────────────────────────────────────────────────

async function handleShorten(
  request,
  env,
  ctx
) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { error: 'Invalid JSON' },
      400
    );
  }

  const {
    destination_url,
    custom_alias,
    title,
    description,
    expires_at,
    is_guest,
    guest_session_id,
    password,
  } = body || {};

  // Destination validation
  if (
    !destination_url ||
    !safeRedirect(destination_url)
  ) {
    return jsonResponse(
      {
        error:
          'A valid HTTPS destination URL is required',
      },
      400
    );
  }

  // Get authenticated user.
  const user =
    await getAuthUser(
      request,
      env
    );

  const authenticated =
    Boolean(user?.sub);

  // Guest means genuinely unauthenticated.
  const guest =
    !authenticated;

  // ─────────────────────────────────────────────
  // GUEST EXPIRY
  // ─────────────────────────────────────────────

  let finalExpiry =
    expires_at || null;

  if (guest) {
    const maxGuestExpiry =
      Date.now() +
      24 * 60 * 60 * 1000;

    if (!finalExpiry) {
      finalExpiry =
        new Date(
          maxGuestExpiry
        ).toISOString();
    } else {
      const requested =
        new Date(
          finalExpiry
        ).getTime();

      if (
        !Number.isFinite(requested) ||
        requested <= Date.now()
      ) {
        return jsonResponse(
          {
            error:
              'Invalid expiry time',
          },
          400
        );
      }

      // Guest links cannot live longer than 24h.
      if (
        requested >
        maxGuestExpiry
      ) {
        finalExpiry =
          new Date(
            maxGuestExpiry
          ).toISOString();
      }
    }
  }

  // ─────────────────────────────────────────────
  // SHORTCODE
  // ─────────────────────────────────────────────

  let shortcode;

  if (custom_alias) {
    const validation =
      validateAlias(
        custom_alias
      );

    if (!validation.ok) {
      return jsonResponse(
        {
          error:
            validation.error,
        },
        400
      );
    }

    // Fast KV check first.
    const kvExisting =
      await env.SHORTUL_KV.get(
        `link:${custom_alias}`
      );

    if (kvExisting) {
      return jsonResponse(
        {
          error:
            'Alias already taken',
        },
        409
      );
    }

    // Primary DB check.
    const dbExisting =
      await fetchLinkFromDB(
        env,
        custom_alias
      );

    if (dbExisting) {
      return jsonResponse(
        {
          error:
            'Alias already taken',
        },
        409
      );
    }

    shortcode =
      custom_alias;
  } else {
    try {
      shortcode =
        await generateUniqueShortcode(
          env
        );
    } catch (error) {
      console.error(
        'Shortcode generation failed:',
        error
      );

      return jsonResponse(
        {
          error:
            'Could not generate shortcode, try again',
        },
        500
      );
    }
  }

  // ─────────────────────────────────────────────
  // PASSWORD HASH
  // ─────────────────────────────────────────────

  let password_hash = null;

  if (password) {
    password_hash =
      await sha256(password);
  }

  // ─────────────────────────────────────────────
  // LINK DATA
  // ─────────────────────────────────────────────

  const linkData = {
    shortcode,

    destination_url,

    title:
      title || null,

    description:
      description || null,

    creator_id:
      authenticated
        ? user.sub
        : null,

    is_guest:
      guest,

    guest_session_id:
      guest
        ? (
            guest_session_id ||
            null
          )
        : null,

    is_active:
      true,

    expires_at:
      finalExpiry,

    password_hash,

    permanent:
      !finalExpiry,

    created_at:
      new Date().toISOString(),

    updated_at:
      new Date().toISOString(),
  };

  // ─────────────────────────────────────────────
  // DATABASE CREATE
  // ─────────────────────────────────────────────

  let created;

  try {
    created =
      await createLinkInDB(
        env,
        linkData
      );
  } catch (error) {
    console.error(
      'Create link failed:',
      error
    );

    return jsonResponse(
      {
        error:
          'Failed to create link',
      },
      500
    );
  }

  // ─────────────────────────────────────────────
  // KV WRITE
  // ─────────────────────────────────────────────

  const kvRecord = {
    id:
      created?.[0]?.id ||
      null,

    shortcode,

    destination_url,

    is_active:
      true,

    expires_at:
      finalExpiry,

    password_hash,

    permanent:
      !finalExpiry,
  };

  try {
    if (finalExpiry) {
      const ttl =
        Math.max(
          60,
          Math.floor(
            (
              new Date(
                finalExpiry
              ).getTime() -
              Date.now()
            ) / 1000
          )
        );

      await env.SHORTUL_KV.put(
        `link:${shortcode}`,
        JSON.stringify(
          kvRecord
        ),
        {
          expirationTtl:
            ttl,
        },
      );
    } else {
      await env.SHORTUL_KV.put(
        `link:${shortcode}`,
        JSON.stringify(
          kvRecord
        )
      );
    }
  } catch (error) {
    console.error(
      'KV write failed:',
      error
    );

    // Link still exists in primary DB.
  }

  const siteUrl =
    env.SITE_URL ||
    'https://shortul.app';

  return jsonResponse({
    ok: true,

    shortcode,

    short_url:
      `${siteUrl}/${shortcode}`,

    destination_url,

    expires_at:
      finalExpiry,

    is_guest:
      guest,
  });
}


// ─────────────────────────────────────────────────────────────
// USER LINKS
// ─────────────────────────────────────────────────────────────

async function handleLinks(
  request,
  env,
  path,
  method
) {
  const user =
    await getAuthUser(
      request,
      env
    );

  if (!user?.sub) {
    return jsonResponse(
      {
        error:
          'Authentication required',
      },
      401
    );
  }

  const match =
    path.match(
      /^\/api\/links\/(\d+)$/
    );

  if (!match) {
    return jsonResponse(
      {
        error:
          'Not found',
      },
      404
    );
  }

  const id =
    match[1];

  // ─────────────────────────────────────────────
  // PATCH
  // ─────────────────────────────────────────────

  if (method === 'PATCH') {
    let body;

    try {
      body =
        await request.json();
    } catch {
      return jsonResponse(
        {
          error:
            'Invalid JSON',
        },
        400
      );
    }

    // IMPORTANT:
    // Fetch only if this link belongs to this user.
    const existing =
      await fetchUserLinkById(
        env,
        id,
        user.sub
      );

    if (!existing) {
      return jsonResponse(
        {
          error:
            'Link not found',
        },
        404
      );
    }

    const updates = {};

    const allowed = [
      'destination_url',
      'title',
      'description',
      'is_active',
      'expires_at',
    ];

    for (const key of allowed) {
      if (
        body[key] !== undefined
      ) {
        updates[key] =
          body[key];
      }
    }

    if (
      updates.destination_url &&
      !safeRedirect(
        updates.destination_url
      )
    ) {
      return jsonResponse(
        {
          error:
            'Invalid destination URL',
        },
        400
      );
    }

    // Do not allow normal users to turn
    // their permanent link into an invalid past expiry.
    if (
      updates.expires_at
    ) {
      const expiry =
        new Date(
          updates.expires_at
        ).getTime();

      if (
        !Number.isFinite(expiry)
      ) {
        return jsonResponse(
          {
            error:
              'Invalid expiry time',
          },
          400
        );
      }
    }

    updates.updated_at =
      new Date().toISOString();

    let updated;

    try {
      updated =
        await updateUserLinkInDB(
          env,
          id,
          user.sub,
          updates
        );
    } catch (error) {
      console.error(
        'Update link failed:',
        error
      );

      return jsonResponse(
        {
          error:
            'Failed to update link',
        },
        500
      );
    }

    if (
      !updated ||
      updated.length === 0
    ) {
      return jsonResponse(
        {
          error:
            'Link not found',
        },
        404
      );
    }

    const link =
      updated[0];

    // ───────────────────────────────────────────
    // UPDATE KV
    // ───────────────────────────────────────────

    if (
      !link.is_active ||
      (
        link.expires_at &&
        new Date(
          link.expires_at
        ).getTime() <=
          Date.now()
      )
    ) {
      try {
        await env.SHORTUL_KV.delete(
          `link:${link.shortcode}`
        );
      } catch {}
    } else {
      await putLinkInKV(
        env,
        link
      );
    }

    return jsonResponse({
      ok: true,
      link,
    });
  }

  // ─────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────

  if (method === 'DELETE') {
    const existing =
      await fetchUserLinkById(
        env,
        id,
        user.sub
      );

    if (!existing) {
      return jsonResponse(
        {
          error:
            'Link not found',
        },
        404
      );
    }

    try {
      await deleteUserLinkFromDB(
        env,
        id,
        user.sub
      );
    } catch (error) {
      console.error(
        'Delete link failed:',
        error
      );

      return jsonResponse(
        {
          error:
            'Failed to delete link',
        },
        500
      );
    }

    try {
      await env.SHORTUL_KV.delete(
        `link:${existing.shortcode}`
      );
    } catch {}

    return jsonResponse({
      ok: true,
    });
  }

  return jsonResponse(
    {
      error:
        'Method not allowed',
    },
    405
  );
}


// ─────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────

async function handleAdmin(
  request,
  env,
  path,
  method
) {
  // Stats
  if (
    path === '/api/admin/stats' &&
    method === 'GET'
  ) {
    try {
      const stats =
        await d1AdminStats(
          env
        );

      return jsonResponse(
        stats
      );
    } catch (error) {
      console.error(
        'Admin stats failed:',
        error
      );

      return jsonResponse(
        {
          error:
            'Failed to load stats',
        },
        500
      );
    }
  }

  // ───────────────────────────────────────────
  // DISABLE
  // ───────────────────────────────────────────

  const disableMatch =
    path.match(
      /^\/api\/admin\/links\/([^/]+)\/disable$/
    );

  if (
    disableMatch &&
    method === 'POST'
  ) {
    const link =
      await resolveLink(
        env,
        disableMatch[1]
      );

    if (!link) {
      return jsonResponse(
        {
          error:
            'Link not found',
        },
        404
      );
    }

    await updateLinkInDB(
      env,
      link.id,
      {
        is_active:
          false,

        updated_at:
          new Date().toISOString(),
      }
    );

    await env.SHORTUL_KV.delete(
      `link:${link.shortcode}`
    );

    return jsonResponse({
      ok: true,
    });
  }

  // ───────────────────────────────────────────
  // EXPIRE
  // ───────────────────────────────────────────

  const expireMatch =
    path.match(
      /^\/api\/admin\/links\/([^/]+)\/expire$/
    );

  if (
    expireMatch &&
    method === 'POST'
  ) {
    const link =
      await resolveLink(
        env,
        expireMatch[1]
      );

    if (!link) {
      return jsonResponse(
        {
          error:
            'Link not found',
        },
        404
      );
    }

    await updateLinkInDB(
      env,
      link.id,
      {
        expires_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      }
    );

    await env.SHORTUL_KV.delete(
      `link:${link.shortcode}`
    );

    return jsonResponse({
      ok: true,
    });
  }

  // ───────────────────────────────────────────
  // DESTINATION UPDATE
  // ───────────────────────────────────────────

  const destMatch =
    path.match(
      /^\/api\/admin\/links\/([^/]+)\/destination$/
    );

  if (
    destMatch &&
    method === 'POST'
  ) {
    const link =
      await resolveLink(
        env,
        destMatch[1]
      );

    if (!link) {
      return jsonResponse(
        {
          error:
            'Link not found',
        },
        404
      );
    }

    let body;

    try {
      body =
        await request.json();
    } catch {
      return jsonResponse(
        {
          error:
            'Invalid JSON',
        },
        400
      );
    }

    if (
      !safeRedirect(
        body.destination_url
      )
    ) {
      return jsonResponse(
        {
          error:
            'Invalid URL',
        },
        400
      );
    }

    const updated =
      await updateLinkInDB(
        env,
        link.id,
        {
          destination_url:
            body.destination_url,

          updated_at:
            new Date().toISOString(),
        }
      );

    if (updated?.[0]) {
      await putLinkInKV(
        env,
        updated[0]
      );
    }

    return jsonResponse({
      ok: true,
    });
  }

  // ───────────────────────────────────────────
  // ADMIN DELETE
  // ───────────────────────────────────────────

  const delMatch =
    path.match(
      /^\/api\/admin\/links\/([^/]+)$/
    );

  if (
    delMatch &&
    method === 'DELETE'
  ) {
    const link =
      await resolveLink(
        env,
        delMatch[1]
      );

    if (!link) {
      return jsonResponse(
        {
          error:
            'Link not found',
        },
        404
      );
    }

    await deleteLinkFromDB(
      env,
      link.id
    );

    await env.SHORTUL_KV.delete(
      `link:${link.shortcode}`
    );

    return jsonResponse({
      ok: true,
    });
  }

  return jsonResponse(
    {
      error:
        'Not found',
    },
    404
  );
}


// ─────────────────────────────────────────────────────────────
// RESOLVE ADMIN LINK
// ─────────────────────────────────────────────────────────────

async function resolveLink(
  env,
  idOrShortcode
) {
  if (
    /^\d+$/.test(
      idOrShortcode
    )
  ) {
    const byId =
      await fetchLinkById(
        env,
        idOrShortcode
      );

    if (byId) {
      return byId;
    }
  }

  return await fetchLinkFromDB(
    env,
    idOrShortcode
  );
}


// ─────────────────────────────────────────────────────────────
// KV HELPER
// ─────────────────────────────────────────────────────────────

async function putLinkInKV(
  env,
  link
) {
  const record = {
    id: link.id,

    shortcode:
      link.shortcode,

    destination_url:
      link.destination_url,

    is_active:
      link.is_active,

    expires_at:
      link.expires_at || null,

    password_hash:
      link.password_hash || null,

    permanent:
      link.permanent !== false,
  };

  if (link.expires_at) {
    const ttl =
      Math.max(
        60,
        Math.floor(
          (
            new Date(
              link.expires_at
            ).getTime() -
            Date.now()
          ) / 1000
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

  await env.SHORTUL_KV.put(
    `link:${link.shortcode}`,
    JSON.stringify(record)
  );
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
// JSON
// ─────────────────────────────────────────────────────────────

function jsonResponse(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        'content-type':
          'application/json',

        'access-control-allow-origin':
          '*',

        'access-control-allow-methods':
          'GET,POST,PATCH,DELETE,OPTIONS',

        'access-control-allow-headers':
          'authorization,content-type',
      },
    }
  );
}


// ─────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────

function corsResponse(env) {
  return new Response(
    null,
    {
      status: 204,

      headers: {
        'access-control-allow-origin':
          '*',

        'access-control-allow-methods':
          'GET,POST,PATCH,DELETE,OPTIONS',

        'access-control-allow-headers':
          'authorization,content-type',
      },
    }
  );
}
