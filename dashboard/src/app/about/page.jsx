import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'About — ShorTul',
  description: 'ShorTul is a premium URL shortener built on Cloudflare\'s global edge network. Made with ❤️ in India.',
  alternates: { canonical: 'https://shortul.app/about' },
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold text-center mb-8">
            About <span className="brand-gradient-text">ShorTul</span>
          </h1>
          <div className="card p-8 space-y-4 text-slate-300">
            <p>
              ShorTul was born from a simple frustration: URL shorteners that make you wait.
              Every redirect should be instant — no matter where you are in the world.
            </p>
            <p>
              So we built ShorTul on <strong className="text-white">Cloudflare&apos;s global edge network</strong>.
              Shortcodes live in Cloudflare KV, replicated to 300+ cities. The redirect Worker does one
              thing — look up the code and redirect — with zero database queries on cache hits.
            </p>
            <p>
              Click analytics are collected asynchronously through Cloudflare Queues and aggregated in
              batches, so tracking never slows down a single redirect.
            </p>
            <p>
              Privacy matters: we store no personal data. Visitor IPs are hashed for uniqueness counting only.
            </p>
            <p className="text-amber-400 font-semibold">
              Made with ❤️ in India. Short links. Faster journeys.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
