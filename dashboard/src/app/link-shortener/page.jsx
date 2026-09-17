import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ShortenerForm from '@/components/ShortenerForm';

export const metadata = {
  title: 'Link Shortener — ShorTul',
  description: 'Free URL shortener with instant redirects. Create short links in seconds, no signup required.',
  alternates: { canonical: 'https://shortul.app/link-shortener' },
};

export default function LinkShortenerPage() {
  return (
    <>
      <Navbar />
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold mb-4">
            Free <span className="brand-gradient-text">Link Shortener</span>
          </h1>
          <p className="text-slate-400 mb-10 max-w-xl mx-auto">
            Paste any URL and get a short link instantly. No account needed.
          </p>
          <ShortenerForm />
        </div>
      </section>
      <Footer />
    </>
  );
}
