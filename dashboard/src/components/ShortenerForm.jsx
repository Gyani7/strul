'use client';
import { useState } from 'react';
import { createShortLink } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function ShortenerForm() {
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const data = await createShortLink({
        destination_url: url,
        custom_alias: alias || undefined,
        is_guest: !token,
        guest_session_id: !token ? (sessionStorage.getItem('guest_session') || (() => {
          const id = crypto.randomUUID();
          sessionStorage.setItem('guest_session', id);
          return id;
        })()) : undefined,
      }, token);
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  function copyLink() {
    if (result?.short_url) {
      navigator.clipboard.writeText(result.short_url);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="card p-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Paste your long URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/very/long/url"
              required
              className="text-base"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Custom alias (optional)</label>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-sm whitespace-nowrap">shortul.app/</span>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="my-link"
                maxLength={32}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-base disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Short Link'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 card p-5 animate-fade-in">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-1">Your short link is ready!</p>
              <p className="text-lg font-semibold text-amber-400 truncate">{result.short_url}</p>
              {result.is_guest && (
                <p className="text-xs text-slate-500 mt-1">Guest link • expires in 24h</p>
              )}
            </div>
            <button
              onClick={copyLink}
              className="btn-secondary !py-2 !px-4 text-sm whitespace-nowrap"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}