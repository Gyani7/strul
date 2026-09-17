'use client';
import { useEffect, useState } from 'react';
import { getAdminStats, adminDisableLink, adminDeleteLink, adminExpireLink, adminUpdateDestination } from '@/lib/api';

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editUrl, setEditUrl] = useState('');

  // Check for stored admin secret
  useEffect(() => {
    const s = sessionStorage.getItem('admin_secret');
    if (s) {
      setSecret(s);
      setAuthed(true);
      loadStats(s);
    }
  }, []);

  async function handleAuth(e) {
    e.preventDefault();
    sessionStorage.setItem('admin_secret', secret);
    setAuthed(true);
    loadStats(secret);
  }

  async function loadStats(s) {
    setLoading(true);
    const data = await getAdminStats(s || secret);
    setStats(data);
    setLoading(false);
  }

  // Fetch links from Supabase via public REST (admin uses service role in worker)
  // For demo, we fetch recent links through the worker admin endpoint
  async function fetchLinks() {
    // The worker admin endpoint can be extended; for now use stats top_links
    if (stats?.top_links) setLinks(stats.top_links);
  }

  useEffect(() => { fetchLinks(); }, [stats]);

  async function handleDisable(shortcode) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/api/admin/links/${shortcode}/disable`, {
      method: 'POST',
      headers: { 'authorization': `Bearer ${secret}` },
    });
    if (res.ok) loadStats();
  }

  async function handleExpire(shortcode) {
    await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/api/admin/links/${shortcode}/expire`, {
      method: 'POST',
      headers: { 'authorization': `Bearer ${secret}` },
    });
    loadStats();
  }

  async function handleDelete(shortcode) {
    if (!confirm(`Delete link /${shortcode}?`)) return;
    await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/api/admin/links/${shortcode}`, {
      method: 'DELETE',
      headers: { 'authorization': `Bearer ${secret}` },
    });
    loadStats();
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Access</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Admin Secret</label>
              <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary w-full">Enter Admin Panel</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <button onClick={() => loadStats()} className="btn-secondary !py-2 text-sm">Refresh</button>
      </div>

      {loading && <p className="text-slate-400">Loading...</p>}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-6">
            <div className="text-3xl font-extrabold brand-gradient-text">{stats.total_clicks?.toLocaleString()}</div>
            <div className="text-sm text-slate-400 mt-1">Total Clicks</div>
          </div>
          <div className="card p-6">
            <div className="text-3xl font-extrabold brand-gradient-text">{stats.today_clicks?.toLocaleString()}</div>
            <div className="text-sm text-slate-400 mt-1">Today&apos;s Clicks</div>
          </div>
          <div className="card p-6">
            <div className="text-3xl font-extrabold brand-gradient-text">{stats.top_links?.length || 0}</div>
            <div className="text-sm text-slate-400 mt-1">Top Links</div>
          </div>
          <div className="card p-6">
            <div className="text-3xl font-extrabold brand-gradient-text">{stats.active_links || '—'}</div>
            <div className="text-sm text-slate-400 mt-1">Active Links</div>
          </div>
        </div>
      )}

      {/* Top links with admin actions */}
      {stats?.top_links && stats.top_links.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Top Links (by recent clicks)</h2>
          <div className="space-y-2">
            {stats.top_links.map((link) => (
              <div key={link.shortcode} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <div>
                  <span className="font-semibold text-amber-400">/{link.shortcode}</span>
                  <span className="text-slate-400 text-sm ml-3">{link.clicks} clicks</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDisable(link.shortcode)} className="btn-secondary !py-1.5 !px-3 text-sm">Disable</button>
                  <button onClick={() => handleExpire(link.shortcode)} className="btn-secondary !py-1.5 !px-3 text-sm">Expire</button>
                  <button onClick={() => handleDelete(link.shortcode)} className="btn-secondary !py-1.5 !px-3 text-sm !bg-red-500/10 !border-red-500/30">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suspicious links note */}
      <div className="card p-6 mt-6">
        <h2 className="text-lg font-semibold mb-2">Abuse Monitoring</h2>
        <p className="text-sm text-slate-400">
          Links with unusually high click rates are flagged for review. Use the actions above to disable, expire, or delete suspicious links.
          All changes immediately invalidate the KV cache entry.
        </p>
      </div>
    </div>
  );
}
