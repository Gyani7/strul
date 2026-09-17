// API helpers — calls the Cloudflare Worker

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || '';

export async function createShortLink(data, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;

  const res = await fetch(`${WORKER_URL}/api/shorten`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateLink(id, updates, token) {
  const res = await fetch(`${WORKER_URL}/api/links/${id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deleteLink(id, token) {
  const res = await fetch(`${WORKER_URL}/api/links/${id}`, {
    method: 'DELETE',
    headers: { 'authorization': `Bearer ${token}` },
  });
  return res.json();
}

export async function getAdminStats(adminSecret) {
  const res = await fetch(`${WORKER_URL}/api/admin/stats`, {
    headers: { 'authorization': `Bearer ${adminSecret}` },
  });
  return res.json();
}

export async function adminDisableLink(id, adminSecret) {
  const res = await fetch(`${WORKER_URL}/api/admin/links/${id}/disable`, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${adminSecret}` },
  });
  return res.json();
}

export async function adminDeleteLink(id, adminSecret) {
  const res = await fetch(`${WORKER_URL}/api/admin/links/${id}`, {
    method: 'DELETE',
    headers: { 'authorization': `Bearer ${adminSecret}` },
  });
  return res.json();
}

export async function adminExpireLink(id, adminSecret) {
  const res = await fetch(`${WORKER_URL}/api/admin/links/${id}/expire`, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${adminSecret}` },
  });
  return res.json();
}

export async function adminUpdateDestination(id, destinationUrl, adminSecret) {
  const res = await fetch(`${WORKER_URL}/api/admin/links/${id}/destination`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${adminSecret}`,
    },
    body: JSON.stringify({ destination_url: destinationUrl }),
  });
  return res.json();
}
