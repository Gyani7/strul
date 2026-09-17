import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Custom Links — ShorTul',
  description: 'Create custom short links with your own alias. Reserved routes protected, collision detection built-in.',
  alternates: { canonical: 'https://shortul.app/custom-links' },
};

export default function CustomLinksPage() {
  return (
    <>
      <Navbar />
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-extrabold text-center mb-4">
            <span className="brand-gradient-text">Custom aliases</span> that fit your brand
          </h1>
          <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">
            Pick any 3-32 character URL-safe alias. ShorTul checks KV and database for collisions and blocks reserved routes.
          </p>
          <div className="card p-8">
            <h3 className="font-semibold text-lg mb-4">How it works</h3>
            <ol className="space-y-4 text-slate-300">
              <li className="flex gap-3"><span className="text-amber-400 font-bold">1.</span> Enter your destination URL and desired alias.</li>
              <li className="flex gap-3"><span className="text-amber-400 font-bold">2.</span> ShorTul validates the alias format and checks against reserved routes (/login, /admin, /api, etc.).</li>
              <li className="flex gap-3"><span className="text-amber-400 font-bold">3.</span> Uniqueness is checked in both KV and the primary database.</li>
              <li className="flex gap-3"><span className="text-amber-400 font-bold">4.</span> The link is created in the database and immediately cached in KV for instant redirects.</li>
            </ol>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
