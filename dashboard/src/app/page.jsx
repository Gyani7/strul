import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ShortenerForm from '@/components/ShortenerForm';
import Link from 'next/link';

export const metadata = {
  title: 'ShorTul — Short links. Faster journeys.',
  description: 'ShorTul is a premium URL shortener built on Cloudflare\'s global edge network. Lightning-fast redirects, real-time analytics, and a beautiful dashboard.',
  alternates: { canonical: 'https://shortul.app' },
  openGraph: {
    title: 'ShorTul — Short links. Faster journeys.',
    description: 'Lightning-fast URL shortener built on Cloudflare\'s global edge network.',
    url: 'https://shortul.app',
    type: 'website',
  },
};

const features = [
  { icon: '⚡', title: 'Edge-First Redirects', desc: 'KV-cached lookups at 300+ Cloudflare edge locations. Sub-50ms redirects worldwide.' },
  { icon: '📊', title: 'Real-Time Analytics', desc: 'Track clicks by country, device, referrer, and time. No personal data stored.' },
  { icon: '🔗', title: 'Custom Short Links', desc: 'Pick your own alias or let ShorTul generate a unique one. Reserved routes protected.' },
  { icon: '👤', title: 'Guest Links', desc: 'Create short links without an account. Auto-expiring, no signup required.' },
  { icon: '🔒', title: 'Password Protection', desc: 'Add a password to sensitive links. Verified at the edge before redirect.' },
  { icon: '🌍', title: 'Global CDN', desc: 'Powered by Cloudflare\'s network spanning 300+ cities in 100+ countries.' },
];

const stats = [
  { value: '<50ms', label: 'Redirect latency' },
  { value: '300+', label: 'Edge locations' },
  { value: '99.9%', label: 'Uptime' },
  { value: '0', label: 'DB queries on cache hit' },
];

const faqs = [
  { q: 'How is ShorTul so fast?', a: 'ShorTul uses Cloudflare KV as a first-level cache at the edge. When a shortcode exists in KV, the Worker returns a 301 redirect immediately — no database query needed. The first request for a new code populates KV, and a daily cron job preloads all active links every morning.' },
  { q: 'Do I need an account to create short links?', a: 'No! Guest links work without signup. They expire after 24 hours by default. Create a free account for persistent links and analytics.' },
  { q: 'Is my data safe?', a: 'ShorTul stores no personal data. Visitor IPs are hashed for uniqueness counting only. All redirects use HTTPS. Supabase service keys never touch the browser.' },
  { q: 'Can I use custom aliases?', a: 'Yes. Choose any 3-32 character URL-safe alias. Reserved routes like /admin and /login are protected from use.' },
  { q: 'What happens when a link expires?', a: 'Expired links return a clean 404 page with a link to our Telegram. The KV record is automatically removed.' },
  { q: 'Is there a free plan?', a: 'Yes! ShorTul is free for guest links and personal use. Pro plans add custom domains, advanced analytics, and higher limits.' },
];

export default function HomePage() {
  return (
    <>
      <Navbar />
      {/* Hero */}
      <section className="relative overflow-hidden hero-glow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-6">
            🚀 Built on Cloudflare&apos;s global edge
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold mb-4">
            Short links. <span className="brand-gradient-text">Faster journeys.</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            ShorTul is a premium URL shortener with sub-50ms redirects powered by Cloudflare KV.
            Create short links in seconds — no signup required.
          </p>
          <ShortenerForm />
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-extrabold brand-gradient-text">{s.value}</div>
              <div className="text-sm text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Why ShorTul?</h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
            Every redirect is served from the nearest Cloudflare edge node. No database on the hot path.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* Pricing */}
      <section className="py-20 px-4 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Simple Pricing</h2>
          <p className="text-slate-400 text-center mb-12">Start free. Upgrade when you need more.</p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="card p-8">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <div className="text-4xl font-extrabold mb-1">₹0</div>
              <p className="text-sm text-slate-400 mb-6">forever</p>
              <ul className="space-y-2 text-sm text-slate-300 mb-6">
                <li>✓ Unlimited guest links</li>
                <li>✓ 24h link expiry</li>
                <li>✓ Basic analytics</li>
                <li>✓ Custom aliases</li>
              </ul>
              <Link href="/signup" className="btn-secondary w-full block text-center">Get Started</Link>
            </div>
            <div className="card p-8 border-amber-500/30 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full">Popular</div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-4xl font-extrabold mb-1">₹299<span className="text-base font-normal text-slate-400">/mo</span></div>
              <p className="text-sm text-slate-400 mb-6">billed monthly</p>
              <ul className="space-y-2 text-sm text-slate-300 mb-6">
                <li>✓ Everything in Free</li>
                <li>✓ Persistent links (no expiry)</li>
                <li>✓ Advanced analytics</li>
                <li>✓ Password protection</li>
                <li>✓ Custom domains</li>
              </ul>
              <Link href="/signup" className="btn-primary w-full block text-center">Upgrade to Pro</Link>
            </div>
            <div className="card p-8">
              <h3 className="text-xl font-bold mb-2">Enterprise</h3>
              <div className="text-4xl font-extrabold mb-1">Custom</div>
              <p className="text-sm text-slate-400 mb-6">contact us</p>
              <ul className="space-y-2 text-sm text-slate-300 mb-6">
                <li>✓ Everything in Pro</li>
                <li>✓ API access</li>
                <li>✓ SSO & SAML</li>
                <li>✓ SLA guarantee</li>
                <li>✓ Dedicated support</li>
              </ul>
              <Link href="/about" className="btn-secondary w-full block text-center">Contact Sales</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.q} className="card p-5 group">
                <summary className="font-semibold cursor-pointer flex items-center justify-between">
                  {faq.q}
                  <span className="text-amber-400 group-open:rotate-180 transition">⌄</span>
                </summary>
                <p className="text-sm text-slate-400 mt-3">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
