export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/api'],
    },
    sitemap: 'https://shortul.app/sitemap.xml',
  };
}
