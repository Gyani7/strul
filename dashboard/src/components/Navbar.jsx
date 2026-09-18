'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let subscription;

    async function loadAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        setUser(data?.session?.user || null);

        const result = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user || null);
        });

        subscription = result?.data?.subscription;
      } catch (error) {
        console.error('Supabase auth initialization failed:', error);
        setUser(null);
      }
    }

    loadAuth();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#0a0a1a]/80 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-extrabold brand-gradient-text">
            ShorTul
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          <Link href="/features" className="hover:text-amber-400 transition">
            Features
          </Link>
          <Link href="/analytics" className="hover:text-amber-400 transition">
            Analytics
          </Link>
          <Link href="/custom-links" className="hover:text-amber-400 transition">
            Custom Links
          </Link>
          <Link href="/pricing" className="hover:text-amber-400 transition">
            Pricing
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="btn-primary !py-2 !px-4 text-sm"
              >
                Dashboard
              </Link>

              <button
                onClick={handleLogout}
                className="btn-secondary !py-2 !px-4 text-sm"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="btn-secondary !py-2 !px-4 text-sm"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="btn-primary !py-2 !px-4 text-sm"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
