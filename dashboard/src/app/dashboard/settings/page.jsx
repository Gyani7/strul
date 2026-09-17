'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Settings</h1>

      <div className="card p-6 max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex justify-between"><span className="text-slate-400">Email</span><span>{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Plan</span><span className="text-amber-400">Free</span></div>
        </div>
      </div>

      <div className="card p-6 max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Danger Zone</h2>
        <p className="text-sm text-slate-400 mb-4">Sign out of your account on this device.</p>
        <button onClick={handleSignOut} className="btn-secondary !bg-red-500/10 !border-red-500/30">
          Sign Out
        </button>
      </div>
    </div>
  );
}
