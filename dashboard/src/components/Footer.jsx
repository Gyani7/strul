import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0a0a1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <div className="text-xl font-extrabold brand-gradient-text mb-3">ShorTul</div>
          <p className="text-sm text-slate-400">Short links. Faster journeys.<br />Built on Cloudflare&apos;s global edge.</p>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3">Product</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/features" className="hover:text-amber-400">Features</Link></li>
            <li><Link href="/analytics" className="hover:text-amber-400">Analytics</Link></li>
            <li><Link href="/custom-links" className="hover:text-amber-400">Custom Links</Link></li>
            <li><Link href="/link-shortener" className="hover:text-amber-400">Link Shortener</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/about" className="hover:text-amber-400">About</Link></li>
            <li><Link href="/pricing" className="hover:text-amber-400">Pricing</Link></li>
            <li><Link href="/privacy" className="hover:text-amber-400">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-amber-400">Terms</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3">Connect</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><a href="https://t.me/shortul" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400">Telegram</a></li>
            <li><a href="https://x.com/shortul" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400">X / Twitter</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} ShorTul. Made with ❤️ in India.
      </div>
    </footer>
  );
}