'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { updateLink, deleteLink } from '@/lib/api';

export default function MyLinksPage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editUrl, setEditUrl] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) setToken(data.session.access_token);
    });
    fetchLinks();
  }, []);

  async function fetchLinks() {
    const { data } = await supabase.from('links').select('*').order('created_at', { ascending: false });
    setLinks(data || []);
    setLoading(false);
  }

  async function handleToggle(link) {
    await updateLink(link.id, { is_active: !link.is_active }, token);
    fetchLinks();
  }

  async function handleDelete(link) {
    if (!confirm(`Delete /${link.shortcode}? This cannot be undone.`)) return;
    await deleteLink(link.id, token);
    fetchLinks();
  }

  function startEdit(link) {
    setEditing(link.id);
    setEditUrl(link.destination_url);
  }

  async function saveEdit(link) {
    await updateLink(link.id, { destination_url: editUrl }, token);
    setEditing(null);
    fetchLinks();
  }

  if (loading) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Links</h1>

      {links.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">No links yet. Create one from the dashboard overview.</div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <div key={link.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-amber-400">/{link.shortcode}</span>
                    {link.is_guest && <span className="text-xs px-2 py-0.5 bg-slate-700 rounded">Guest</span>}
                    {!link.is_active && <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">Inactive</span>}
                    {link.expires_at && <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded">Expires {new Date(link.expires_at).toLocaleDateString()}</span>}
                  </div>
                  {editing === link.id ? (
                    <div className="flex gap-2">
                      <input type="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="flex-1 text-sm" />
                      <button onClick={() => saveEdit(link)} className="btn-primary !py-1.5 !px-3 text-sm">Save</button>
                      <button onClick={() => setEditing(null)} className="btn-secondary !py-1.5 !px-3 text-sm">Cancel</button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 truncate">{link.destination_url}</p>
                  )}
                  {link.title && <p className="text-xs text-slate-500 mt-1">{link.title}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(link)} className="btn-secondary !py-1.5 !px-3 text-sm">Edit</button>
                  <button onClick={() => handleToggle(link)} className="btn-secondary !py-1.5 !px-3 text-sm">
                    {link.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => handleDelete(link)} className="btn-secondary !py-1.5 !px-3 text-sm !bg-red-500/10 !border-red-500/30">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
