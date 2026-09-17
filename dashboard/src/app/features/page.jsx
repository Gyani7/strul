import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Features — ShorTul',
  description: 'Explore ShorTul features: edge-first redirects, real-time analytics, custom links, guest links, password protection, and more.',
  alternates: { canonical: 'https://shortul.app/features' },
};

const features = [
  { icon: '⚡', title: 'KV-First Redirects', desc: 'Cloudflare KV caches every active shortcode at the edge. Cache hits return 301 in under 50ms — zero database queries.' },
  { icon: '📊', title: 'Real-Time Analytics', desc: 'Click events are queued asynchronously and aggregated by date, hour, country, device, and referrer. Redirects never wait for analytics.' },
  { icon: '🔗', title: 'Custom Aliases', desc: 'Choose your own shortcode or auto-generate. Collision detection, reserved route protection, and uniqueness validation built-in.' },
  { icon: '👤', title: 'Guest Links', desc: 'Visitors create short links without an account. Auto-expiring with configurable TTL. Clearly marked as guest links.' },
  { icon: '🔒', title: 'Password Protection', desc: 'Add a SHA-256 password hash to sensitive links. Verified at the edge before redirect. Stored securely, never plaintext.' },
  { icon: '🕐', title: 'Scheduled Cache Preload', desc: 'A daily cron trigger preloads all active links into KV before traffic starts. Evening sync writes aggregated clicks to the database.' },
  { icon: '🛡️', title: 'Abuse Protection', desc: 'Rate limiting, URL validation, dangerous protocol blocking, reserved aliases, and admin moderation tools.' },
  { icon: '🌍', title: 'Global Edge Network', desc: '300+ Cloudflare edge locations. Your links are fast everywhere — Mumbai, Singapore, Frankfurt, São Paulo, and beyond.' },
];

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-extrabold text-center mb-4">
            Built for <span className="brand-gradient-text">speed</span> and <span className="brand-gradient-text">scale</span>
          </h1>
          <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">
            Every feature is designed around one principle: the redirect path should do as little work as possible.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card p-6">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
