'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setDisplayName(data.user?.user_metadata?.display_name || '');
    });
    supabase.from('users').select('*').single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || '');
      }
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    await supabase.from('users').update({
      display_name: displayName,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    setSaving(false);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Profile</h1>
      <div className="card p-6 max-w-lg space-y-4">
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Email</label>
          <input type="email" value={user?.email || ''} disabled className="opacity-50" />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Display Name</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-1 block">User ID</label>
          <input type="text" value={user?.id || ''} disabled className="opacity-50 text-xs" />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
