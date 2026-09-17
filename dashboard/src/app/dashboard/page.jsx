'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createShortLink } from '@/lib/api';
import Link from 'next/link';

export default function DashboardOverview() {
  const [user, setUser] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchLinks();
  }, []);

  async function fetchLinks() {
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (!error) setLinks(data || []);
    setLoading(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await createShortLink({
      destination_url: url,
      custom_alias: alias || undefined,
    }, session?.access_token);
    if (res.error) {
      setError(res.error);
    } else {
      setResult(res);
      setUrl('');
      setAlias('');
      fetchLinks();
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋</h1>
        <p className="text-slate-400">Create a new short link or manage your existing ones.</p>
      </div>

      {/* Create Link */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Create Short Link</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Destination URL</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" required />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Custom alias (optional)</label>
            <input type="text" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="my-link" maxLength={32} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {result && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm">
              Created: <a href={result.short_url} target="_blank" rel="noopener noreferrer" className="text-amber-400 font-semibold">{result.short_url}</a>
            </div>
          )}
          <button type="submit" className="btn-primary">Create Short Link</button>
        </form>
      </div>

      {/* Recent Links */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Links</h2>
          <Link href="/dashboard/links" className="text-sm text-amber-400 hover:underline">View all →</Link>
        </div>
        {loading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : links.length === 0 ? (
          <p className="text-slate-400 text-sm">No links yet. Create your first one above!</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-amber-400">/{link.shortcode}</div>
                  <div className="text-xs text-slate-400 truncate">{link.destination_url}</div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {link.is_guest && <span className="text-xs px-2 py-1 bg-slate-700 rounded">Guest</span>}
                  {!link.is_active && <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded">Inactive</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
