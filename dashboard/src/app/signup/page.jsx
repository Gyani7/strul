'use client';
import { useState } from 'react';
import { signUp } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error } = await signUp(email, password, displayName);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.session) {
      router.push('/dashboard');
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 hero-glow">
        <div className="card p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Check your email</h1>
          <p className="text-slate-400 mb-6">We&apos;ve sent a confirmation link. Click it to activate your account.</p>
          <Link href="/login" className="btn-primary inline-block">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 hero-glow">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-3xl font-extrabold brand-gradient-text mb-8">ShorTul</Link>
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">Create your account</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Display Name</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>
          <p className="text-sm text-slate-400 text-center mt-6">
            Already have an account? <Link href="/login" className="text-amber-400">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
