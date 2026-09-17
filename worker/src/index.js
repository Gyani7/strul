import { handleRedirect } from './redirect.js';
import { handleApi } from './api.js';
import { handleScheduled } from './cron.js';
import { handleQueue } from './queue-consumer.js';
import { notFoundPage } from './404.js';

const RESERVED = new Set([
  'login', 'signup', 'dashboard', 'admin', 'api', 'about', 'pricing',
  'terms', 'privacy', 'features', 'analytics', 'custom-links',
  'link-shortener', 'favicon.ico', 'robots.txt', 'sitemap.xml',
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ── API routes ──
    if (path === '/api/shorten' || path.startsWith('/api/links') ||
        path.startsWith('/api/admin') || path === '/api/health') {
      return handleApi(request, env, ctx);
    }

    // ── Reserved routes (let Next.js handle) ──
    const firstSeg = path.split('/')[1] || '';
    if (RESERVED.has(firstSeg)) {
      return fetchOrigin(request, env);
    }

    // ── Redirect path ──
    const shortcode = path.slice(1); // remove leading /
    if (!shortcode || shortcode.length > 32) {
      return notFoundResponse(env);
    }

    return handleRedirect(request, env, ctx, shortcode);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env, ctx));
  },

  async queue(batch, env, ctx) {
    return handleQueue(batch, env, ctx);
  },
};

// Fallback to Next.js origin (for reserved routes / dashboard SPA)
async function fetchOrigin(request, env) {
  const originUrl = env.ORIGIN_URL || 'https://shortul-pages.pages.dev';
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, originUrl);
  const init = {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'manual',
  };
  try {
    return await fetch(target, init);
  } catch {
    return new Response('Origin unavailable', { status: 502 });
  }
}

function notFoundResponse(env) {
  return new Response(notFoundPage(env), {
    status: 404,
    headers: { 'content-type': 'text/html;charset=utf-8' },
  });
}
