import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Terms of Service — ShorTul',
  description: 'ShorTul terms of service: acceptable use, prohibited content, and service availability.',
  alternates: { canonical: 'https://shortul.app/terms' },
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold mb-8">Terms of Service</h1>
          <div className="card p-8 space-y-6 text-slate-300 text-sm">
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">1. Acceptance of Terms</h2>
              <p>By using ShorTul you agree to these terms. If you do not agree, please do not use the service.</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">2. Acceptable Use</h2>
              <p>You may not use ShorTul to create links to illegal content, malware, phishing pages, or content that violates applicable law. ShorTul reserves the right to disable or delete links that violate this policy.</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">3. Guest Links</h2>
              <p>Guest links expire automatically (default 24 hours). ShorTul may remove guest links at any time without notice.</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">4. Service Availability</h2>
              <p>ShorTul aims for 99.9% uptime but does not guarantee uninterrupted service. We are not liable for damages arising from service interruptions.</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">5. Termination</h2>
              <p>We may suspend or terminate accounts that violate these terms or abuse the service.</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">6. Changes</h2>
              <p>These terms may be updated. Continued use of ShorTul after changes constitutes acceptance.</p>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
