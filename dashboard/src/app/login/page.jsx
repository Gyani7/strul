'use client';
import { useState } from 'react';
import { signIn } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 hero-glow">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-3xl font-extrabold brand-gradient-text mb-8">ShorTul</Link>
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">Welcome back</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-sm text-slate-400 text-center mt-6">
            Don&apos;t have an account? <Link href="/signup" className="text-amber-400">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
