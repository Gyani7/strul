import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Analytics — ShorTul',
  description: 'Real-time click analytics: track clicks by country, device, referrer, date, and hour. No personal data stored.',
  alternates: { canonical: 'https://shortul.app/analytics' },
};

export default function AnalyticsPage() {
  const metrics = [
    { label: 'Total Clicks', desc: 'Aggregate count across all your links, updated via evening sync.' },
    { label: 'Clicks by Date', desc: 'Daily and hourly breakdowns to spot trends and peak traffic.' },
    { label: 'Country', desc: 'Geographic distribution from Cloudflare\'s CF-IPCountry header.' },
    { label: 'Device Type', desc: 'Mobile, tablet, or desktop — detected from the User-Agent.' },
    { label: 'Referrer', desc: 'Top referring sources to understand where your traffic comes from.' },
    { label: 'Unique Visitors', desc: 'Hashed IP+UA for deduplication. No raw IPs or personal data stored.' },
  ];

  return (
    <>
      <Navbar />
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-extrabold text-center mb-4">
            Analytics that <span className="brand-gradient-text">never slow you down</span>
          </h1>
          <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">
            Click events are collected asynchronously via Cloudflare Queues and aggregated in D1 before batch-syncing to your database.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {metrics.map((m) => (
              <div key={m.label} className="card p-6">
                <h3 className="font-semibold text-lg mb-2 text-amber-400">{m.label}</h3>
                <p className="text-sm text-slate-400">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
