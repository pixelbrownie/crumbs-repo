'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Loader2, ArrowRight, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const initialMode = new URLSearchParams(window.location.search).get('mode');
    if (initialMode === 'signup') setMode('signup');
  }, []);

  const getSupabase = () => {
    const { createClient } = require('@/lib/supabase');
    return createClient();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const supabase = getSupabase();
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Check your email for a confirmation link!' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Enter your email first.' });
      return;
    }
    setMessage(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Magic link sent — check your inbox.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMessage({ type: 'error', text: error.message });
      setGoogleLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">crumbs</h1>
          <p className="text-sm text-muted mt-1">every piece you love.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">crumbs</h1>
          <p className="text-sm text-muted mt-1">every piece you love.</p>
        </div>

        {/* Card */}
        <div className="bg-canvas border border-border rounded-3xl shadow-card overflow-hidden">
          {/* Mode toggle */}
          <div className="flex border-b border-border">
            {(['login', 'signup'] as AuthMode[]).map((m) => (
              <button
                key={m}
                id={`auth-tab-${m}`}
                onClick={() => { setMode(m); setMessage(null); }}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors duration-150 ${
                  mode === m
                    ? 'text-ink bg-surface'
                    : 'text-muted hover:text-ink-light'
                }`}
              >
                {m === 'login' ? 'sign in' : 'sign up'}
              </button>
            ))}
          </div>

          <div className="px-6 py-6 space-y-4">
            {/* Google */}
            <button
              id="google-auth-btn"
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-border rounded-xl text-sm font-medium text-ink hover:bg-surface transition-colors duration-150 disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                id="email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-all"
              />
              <input
                type="password"
                id="password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-all"
              />

              <AnimatePresence>
                {message && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`text-xs px-3 py-2 rounded-lg ${
                      message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-500'
                    }`}
                  >
                    {message.text}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="submit"
                id="submit-auth-btn"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-ink text-canvas text-sm font-semibold rounded-xl hover:bg-ink-light transition-colors duration-150 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'sign in' : 'create account'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {mode === 'login' && (
                <button
                  type="button"
                  id="magic-link-btn"
                  onClick={handleMagicLink}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-border text-sm font-medium text-ink rounded-xl hover:bg-surface transition-colors duration-150 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  email magic link
                </button>
              )}
            </form>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted mt-6">
          by signing up, you&apos;re agreeing to collect your crumbs responsibly 🍞
        </p>
      </motion.div>
    </div>
  );
}
