import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Privacy Policy — ShorTul',
  description: 'ShorTul privacy policy: we store no personal data, hash visitor IPs, and never sell your information.',
  alternates: { canonical: 'https://shortul.app/privacy' },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold mb-8">Privacy Policy</h1>
          <div className="card p-8 space-y-6 text-slate-300 text-sm">
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">1. Data We Collect</h2>
              <p>ShorTul is designed to collect the minimum data necessary. For redirects we record: the shortcode, timestamp, country (from Cloudflare's CF-IPCountry header), device type, and referrer. Visitor IP addresses are hashed (SHA-256) for unique-visitor counting only — raw IPs are never stored.</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">2. Accounts</h2>
              <p>When you create an account, we store your email and display name via Supabase Auth. Passwords are handled by Supabase Auth and never stored in plaintext.</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">3. Cookies</h2>
              <p>We use Supabase Auth session cookies for logged-in functionality. No third-party tracking cookies.</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">4. Data Sharing</h2>
              <p>We never sell or share your personal data. Data is processed by Cloudflare (edge network) and Supabase (database hosting).</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">5. Data Retention</h2>
              <p>Guest links expire after 24 hours and their KV records are removed. Click statistics are retained for analytics purposes. You may delete your account and data at any time.</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">6. Contact</h2>
              <p>Questions? Reach us on <a href="https://t.me/shortul" className="text-amber-400">Telegram</a>.</p>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
