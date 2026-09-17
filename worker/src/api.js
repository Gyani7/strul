// ── Link management API + admin ────────────────────────────────

import { validateAlias, generateUniqueShortcode } from './shortcode.js';
import { safeRedirect, isAdmin, getAuthUser, escapeHtml } from './security.js';
import {
  createLinkInDB, updateLinkInDB, deleteLinkFromDB, fetchLinkFromDB,
  d1AdminStats,
} from './db.js';

export async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS
  if (method === 'OPTIONS') {
    return corsResponse();
  }

  // ── Health check ──
  if (path === '/api/health') {
    return jsonResponse({ ok: true, ts: Date.now() });
  }

  // ── Create short link (public — guest or authenticated) ──
  if (path === '/api/shorten' && method === 'POST') {
    return handleShorten(request, env, ctx);
  }

  // ── Admin endpoints ──
  if (path.startsWith('/api/admin')) {
    if (!isAdmin(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return handleAdmin(request, env, path, method);
  }

  // ── Link management (authenticated) ──
  if (path.startsWith('/api/links')) {
    return handleLinks(request, env, path, method);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ── Create short link ──
async function handleShorten(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { destination_url, custom_alias, title, description, expires_at, is_guest, guest_session_id, password } = body;

  // Validate destination URL
  if (!destination_url || !safeRedirect(destination_url)) {
    return jsonResponse({ error: 'A valid HTTPS destination URL is required' }, 400);
  }

  const user = getAuthUser(request);

  // Determine shortcode
  let shortcode;
  if (custom_alias) {
    const validation = validateAlias(custom_alias);
    if (!validation.ok) {
      return jsonResponse({ error: validation.error }, 400);
    }
    // Check uniqueness in KV + DB
    const inKV = await env.SHORTUL_KV.get(`link:${custom_alias}`);
    if (inKV) return jsonResponse({ error: 'Alias already taken' }, 409);
    const inDB = await fetchLinkFromDB(env, custom_alias);
    if (inDB) return jsonResponse({ error: 'Alias already taken' }, 409);
    shortcode = custom_alias;
  } else {
    try {
      shortcode = await generateUniqueShortcode(env);
    } catch {
      return jsonResponse({ error: 'Could not generate shortcode, try again' }, 500);
    }
  }

  // Guest link defaults
  const isGuest = is_guest || !user;
  const guestExpiry = isGuest && !expires_at
    ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h default for guests
    : expires_at;

  // Password hash (if provided)
  let password_hash = null;
  if (password) {
    const data = new TextEncoder().encode(password);
    const buf = await crypto.subtle.digest('SHA-256', data);
    password_hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const linkData = {
    shortcode,
    destination_url,
    title: title || null,
    description: description || null,
    creator_id: user?.sub || null,
    is_guest: isGuest,
    guest_session_id: isGuest ? (guest_session_id || null) : null,
    is_active: true,
    expires_at: guestExpiry || null,
    password_hash,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Write to DB (source of truth)
  let created;
  try {
    created = await createLinkInDB(env, linkData);
  } catch (e) {
    return jsonResponse({ error: 'Failed to create link' }, 500);
  }

  // 2. Populate KV immediately (cache consistency)
  const ttl = linkData.expires_at
    ? Math.max(60, Math.floor((new Date(linkData.expires_at).getTime() - Date.now()) / 1000))
    : 86400;
  const kvRecord = {
    id: created[0]?.id,
    shortcode,
    destination_url,
    is_active: true,
    expires_at: linkData.expires_at,
    password_hash,
    permanent: true,
  };
  try {
    await env.SHORTUL_KV.put(`link:${shortcode}`, JSON.stringify(kvRecord), {
      expirationTtl: ttl,
    });
  } catch {}

  const siteUrl = env.SITE_URL || 'https://shortul.app';
  return jsonResponse({
    shortcode,
    short_url: `${siteUrl}/${shortcode}`,
    destination_url,
    expires_at: linkData.expires_at,
    is_guest: isGuest,
  });
}

// ── Link CRUD (authenticated users manage their links) ──
async function handleLinks(request, env, path, method) {
  const user = getAuthUser(request);
  if (!user) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  // /api/links/:id
  const match = path.match(/^\/api\/links\/(\d+)$/);
  if (match) {
    const id = match[1];

    if (method === 'PATCH') {
      const body = await request.json();
      const updates = {};
      const allowed = ['destination_url', 'title', 'description', 'is_active', 'expires_at'];

      for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      if (updates.destination_url && !safeRedirect(updates.destination_url)) {
        return jsonResponse({ error: 'Invalid destination URL' }, 400);
      }
      updates.updated_at = new Date().toISOString();

      // Update DB
      const updated = await updateLinkInDB(env, id, updates);

      if (!updated || updated.length === 0) {
        return jsonResponse({ error: 'Link not found' }, 404);
      }

      const link = updated[0];

      // Update KV (cache consistency)
      if (!link.is_active || (link.expires_at && new Date(link.expires_at) < new Date())) {
        await env.SHORTUL_KV.delete(`link:${link.shortcode}`);
      } else {
        const ttl = link.expires_at
          ? Math.max(60, Math.floor((new Date(link.expires_at).getTime() - Date.now()) / 1000))
          : 86400;
        await env.SHORTUL_KV.put(`link:${link.shortcode}`, JSON.stringify({
          id: link.id,
          shortcode: link.shortcode,
          destination_url: link.destination_url,
          is_active: link.is_active,
          expires_at: link.expires_at,
          password_hash: link.password_hash,
          permanent: true,
        }), { expirationTtl: ttl });
      }

      return jsonResponse({ ok: true, link });
    }

    if (method === 'DELETE') {
      // Fetch link first to get shortcode for KV deletion
      const link = await fetchLinkById(env, id);
      // Delete from DB
      await deleteLinkFromDB(env, id);
      // Delete from KV
      if (link) {
        await env.SHORTUL_KV.delete(`link:${link.shortcode}`);
      }
      return jsonResponse({ ok: true });
    }
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ── Admin API ──
async function handleAdmin(request, env, path, method) {
  // /api/admin/stats
  if (path === '/api/admin/stats' && method === 'GET') {
    const stats = await d1AdminStats(env);
    return jsonResponse(stats);
  }

  // /api/admin/links/:idOrShortcode/disable
  const disableMatch = path.match(/^\/api\/admin\/links\/([^/]+)\/disable$/);
  if (disableMatch && method === 'POST') {
    const link = await resolveLink(env, disableMatch[1]);
    if (!link) return jsonResponse({ error: 'Link not found' }, 404);
    await updateLinkInDB(env, link.id, { is_active: false, updated_at: new Date().toISOString() });
    await env.SHORTUL_KV.delete(`link:${link.shortcode}`);
    return jsonResponse({ ok: true });
  }

  // /api/admin/links/:idOrShortcode/expire
  const expireMatch = path.match(/^\/api\/admin\/links\/([^/]+)\/expire$/);
  if (expireMatch && method === 'POST') {
    const link = await resolveLink(env, expireMatch[1]);
    if (!link) return jsonResponse({ error: 'Link not found' }, 404);
    await updateLinkInDB(env, link.id, {
      expires_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await env.SHORTUL_KV.delete(`link:${link.shortcode}`);
    return jsonResponse({ ok: true });
  }

  // /api/admin/links/:idOrShortcode/destination
  const destMatch = path.match(/^\/api\/admin\/links\/([^/]+)\/destination$/);
  if (destMatch && method === 'POST') {
    const link = await resolveLink(env, destMatch[1]);
    if (!link) return jsonResponse({ error: 'Link not found' }, 404);
    const body = await request.json();
    if (!safeRedirect(body.destination_url)) {
      return jsonResponse({ error: 'Invalid URL' }, 400);
    }
    const updated = await updateLinkInDB(env, link.id, {
      destination_url: body.destination_url,
      updated_at: new Date().toISOString(),
    });
    if (updated[0]) {
      const u = updated[0];
      const ttl = u.expires_at
        ? Math.max(60, Math.floor((new Date(u.expires_at).getTime() - Date.now()) / 1000))
        : 86400;
      await env.SHORTUL_KV.put(`link:${u.shortcode}`, JSON.stringify({
        id: u.id, shortcode: u.shortcode, destination_url: u.destination_url,
        is_active: u.is_active, expires_at: u.expires_at, password_hash: u.password_hash,
        permanent: true,
      }), { expirationTtl: ttl });
    }
    return jsonResponse({ ok: true });
  }

  // /api/admin/links/:idOrShortcode (delete)
  const delMatch = path.match(/^\/api\/admin\/links\/([^/]+)$/);
  if (delMatch && method === 'DELETE') {
    const link = await resolveLink(env, delMatch[1]);
    if (!link) return jsonResponse({ error: 'Link not found' }, 404);
    await deleteLinkFromDB(env, link.id);
    await env.SHORTUL_KV.delete(`link:${link.shortcode}`);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// Resolve a link by numeric ID or shortcode
async function resolveLink(env, idOrShortcode) {
  // Try numeric ID first
  if (/^\d+$/.test(idOrShortcode)) {
    const { fetchLinkById } = await import('./db.js');
    const link = await fetchLinkById(env, idOrShortcode);
    if (link) return link;
  }
  // Fall back to shortcode lookup
  return await fetchLinkFromDB(env, idOrShortcode);
}

// ── Helpers ──
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
    },
  });
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
    },
  });
}
