import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export const metadata = {
  title: 'Pricing — ShorTul',
  description: 'ShorTul pricing: Free forever plan, Pro at ₹299/month, and Enterprise. Start free, upgrade when you need more.',
  alternates: { canonical: 'https://shortul.app/pricing' },
};

export default function PricingPage() {
  const plans = [
    {
      name: 'Free',
      price: '₹0',
      period: 'forever',
      features: ['Unlimited guest links', '24h link expiry', 'Basic analytics', 'Custom aliases', 'Community support'],
      cta: 'Get Started',
      href: '/signup',
      popular: false,
    },
    {
      name: 'Pro',
      price: '₹299',
      period: '/month',
      features: ['Everything in Free', 'Persistent links (no expiry)', 'Advanced analytics', 'Password protection', 'Custom domains', 'Priority support'],
      cta: 'Upgrade to Pro',
      href: '/signup',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'contact us',
      features: ['Everything in Pro', 'API access', 'SSO & SAML', 'SLA guarantee', 'Dedicated support'],
      cta: 'Contact Sales',
      href: '/about',
      popular: false,
    },
  ];

  return (
    <>
      <Navbar />
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-extrabold text-center mb-4">
            Pricing that <span className="brand-gradient-text">grows with you</span>
          </h1>
          <p className="text-slate-400 text-center mb-12">Start free. Upgrade when you need more.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div key={p.name} className={`card p-8 ${p.popular ? 'border-amber-500/30 relative' : ''}`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full">Popular</div>
                )}
                <h3 className="text-xl font-bold mb-2">{p.name}</h3>
                <div className="text-4xl font-extrabold mb-1">{p.price}<span className="text-base font-normal text-slate-400"> {p.period}</span></div>
                <ul className="space-y-2 text-sm text-slate-300 my-6">
                  {p.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
                <Link href={p.href} className={`${p.popular ? 'btn-primary' : 'btn-secondary'} w-full block text-center`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
