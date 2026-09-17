import { handleRedirect } from './redirect.js';
import { handleApi } from './api.js';
import { handleScheduled } from './cron.js';
import { handleQueue } from './queue-consumer.js';
import { notFoundPage } from './404.js';

const RESERVED = new Set([
  'login',
  'signup',
  'dashboard',
  'admin',
  'api',
  'about',
  'pricing',
  'terms',
  'privacy',
  'features',
  'analytics',
  'custom-links',
  'link-shortener',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API routes
    if (
      path === '/api/shorten' ||
      path.startsWith('/api/links') ||
      path.startsWith('/api/admin') ||
      path === '/api/health'
    ) {
      return handleApi(request, env, ctx);
    }

    // Homepage → frontend origin
    if (path === '/' || path === '') {
      return fetchOrigin(request, env);
    }

    // Reserved frontend routes → frontend origin
    const firstSeg = path.split('/')[1] || '';

    if (RESERVED.has(firstSeg)) {
      return fetchOrigin(request, env);
    }

    // Only one path segment can be a shortcode.
    // Example: /abc123 = shortcode
    // Example: /dashboard/settings = frontend route
    const segments = path.split('/').filter(Boolean);

    if (segments.length !== 1) {
      return fetchOrigin(request, env);
    }

    const shortcode = segments[0];

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

async function fetchOrigin(request, env) {
  const originUrl = env.ORIGIN_URL;

  if (!originUrl) {
    return new Response('Origin not configured', {
      status: 502,
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
      },
    });
  }

  const incoming = new URL(request.url);
  const target = new URL(
    incoming.pathname + incoming.search,
    originUrl
  );

  const init = {
    method: request.method,
    headers: request.headers,
    redirect: 'manual',
  };

  // Forward body only for methods that can have one.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  try {
    return await fetch(target, init);
  } catch (error) {
    console.error('Frontend origin failed:', error);

    return new Response('Origin unavailable', {
      status: 502,
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
      },
    });
  }
}

function notFoundResponse(env) {
  return new Response(notFoundPage(env), {
    status: 404,
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      'cache-control': 'no-store',
    },
  });
}
