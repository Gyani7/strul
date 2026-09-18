// API helpers — calls the Cloudflare Worker

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ||
  'https://strul.shrt7.workers.dev';

async function parseResponse(res) {
  const text = await res.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      error: text || `Request failed with status ${res.status}`,
    };
  }

  if (!res.ok) {
    return {
      ...data,
      success: false,
      error:
        data?.error ||
        data?.message ||
        `Request failed with status ${res.status}`,
    };
  }

  return data;
}

function authHeaders(token) {
  const headers = {
    'content-type': 'application/json',
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  return headers;
}

// ─────────────────────────────────────────────
// Create short link
// ─────────────────────────────────────────────

export async function createShortLink(data, token) {
  try {
    const res = await fetch(`${WORKER_URL}/api/shorten`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });

    return await parseResponse(res);
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to connect to ShorTul Worker',
    };
  }
}

// ─────────────────────────────────────────────
// Update link
// ─────────────────────────────────────────────

export async function updateLink(id, updates, token) {
  try {
    const res = await fetch(`${WORKER_URL}/api/links/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(updates),
    });

    return await parseResponse(res);
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to connect to ShorTul Worker',
    };
  }
}

// ─────────────────────────────────────────────
// Delete link
// ─────────────────────────────────────────────

export async function deleteLink(id, token) {
  try {
    const headers = {};

    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${WORKER_URL}/api/links/${id}`, {
      method: 'DELETE',
      headers,
    });

    return await parseResponse(res);
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to connect to ShorTul Worker',
    };
  }
}

// ─────────────────────────────────────────────
// Admin stats
// ─────────────────────────────────────────────

export async function getAdminStats(adminSecret) {
  try {
    const res = await fetch(`${WORKER_URL}/api/admin/stats`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${adminSecret}`,
      },
    });

    return await parseResponse(res);
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to connect to ShorTul Worker',
    };
  }
}

// ─────────────────────────────────────────────
// Admin disable link
// ─────────────────────────────────────────────

export async function adminDisableLink(id, adminSecret) {
  try {
    const res = await fetch(
      `${WORKER_URL}/api/admin/links/${id}/disable`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminSecret}`,
        },
      }
    );

    return await parseResponse(res);
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to connect to ShorTul Worker',
    };
  }
}

// ─────────────────────────────────────────────
// Admin delete link
// ─────────────────────────────────────────────

export async function adminDeleteLink(id, adminSecret) {
  try {
    const res = await fetch(`${WORKER_URL}/api/admin/links/${id}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${adminSecret}`,
      },
    });

    return await parseResponse(res);
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to connect to ShorTul Worker',
    };
  }
}

// ─────────────────────────────────────────────
// Admin expire link
// ─────────────────────────────────────────────

export async function adminExpireLink(id, adminSecret) {
  try {
    const res = await fetch(
      `${WORKER_URL}/api/admin/links/${id}/expire`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminSecret}`,
        },
      }
    );

    return await parseResponse(res);
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to connect to ShorTul Worker',
    };
  }
}

// ─────────────────────────────────────────────
// Admin update destination
// ─────────────────────────────────────────────

export async function adminUpdateDestination(
  id,
  destinationUrl,
  adminSecret
) {
  try {
    const res = await fetch(
      `${WORKER_URL}/api/admin/links/${id}/destination`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({
          destination_url: destinationUrl,
        }),
      }
    );

    return await parseResponse(res);
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to connect to ShorTul Worker',
    };
  }
}

