export default function sitemap() {
  const base = 'https://shortul.app';
  const routes = [
    '', '/features', '/analytics', '/custom-links', '/link-shortener',
    '/about', '/pricing', '/privacy', '/terms', '/login', '/signup',
    '/dashboard', '/dashboard/links', '/dashboard/analytics',
    '/dashboard/profile', '/dashboard/settings',
  ];
  const now = new Date();

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1.0 : route.includes('dashboard') ? 0.3 : 0.8,
  }));
}
