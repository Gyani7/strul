// ── Shortcode generation + validation ──────────────────────────

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LENGTH = 6;

const RESERVED_ROUTES = new Set([
  'login', 'signup', 'dashboard', 'admin', 'api', 'about', 'pricing',
  'terms', 'privacy', 'features', 'analytics', 'custom-links',
  'link-shortener', 'health', 'status', 'help', 'support',
  'blog', 'docs', 'favicon.ico', 'robots.txt', 'sitemap.xml',
  'manifest.json', 'sw.js',
]);

export function isValidShortcode(code) {
  if (!code || typeof code !== 'string') return false;
  if (code.length < 3 || code.length > 32) return false;
  // URL-safe, alphanumeric + hyphens
  return /^[a-zA-Z0-9-]+$/.test(code);
}

export function isReservedRoute(code) {
  return RESERVED_ROUTES.has(code.toLowerCase());
}

export function validateAlias(alias) {
  if (!alias) return { ok: false, error: 'Alias is required' };
  if (!isValidShortcode(alias)) {
    return { ok: false, error: 'Alias must be 3-32 URL-safe characters (a-z, A-Z, 0-9, -)' };
  }
  if (isReservedRoute(alias)) {
    return { ok: false, error: 'This alias is reserved' };
  }
  return { ok: true };
}

export function generateShortcode() {
  const bytes = new Uint8Array(LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

// Generate with collision retry against KV + DB
export async function generateUniqueShortcode(env, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateShortcode();
    // Check KV
    const existsKV = await env.SHORTUL_KV.get(`link:${code}`);
    if (existsKV) continue;
    // Check DB (import lazily to avoid circular dep)
    const { fetchLinkFromDB } = await import('./db.js');
    const existsDB = await fetchLinkFromDB(env, code);
    if (existsDB) continue;
    return code;
  }
  throw new Error('Could not generate unique shortcode after retries');
}
