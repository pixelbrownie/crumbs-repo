'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Loader2, ArrowRight, Mail, AtSign, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState(''); // can be username or email for login
  const [email, setEmail] = useState(''); // for signup
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<{ available?: boolean; error?: string } | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const searchParams = new URLSearchParams(window.location.search);
    const initialMode = searchParams.get('mode');
    if (initialMode === 'signup') setMode('signup');
    const urlError = searchParams.get('error');
    if (urlError) {
      setMessage({
        type: 'error',
        text: urlError === 'auth' ? 'Authentication failed. Please check your credentials.' : decodeURIComponent(urlError),
      });
    }
  }, []);

  const getSupabase = () => {
    const { createClient } = require('@/lib/supabase');
    return createClient();
  };

  const handleCheckUsername = async (uname: string) => {
    const clean = uname.toLowerCase().trim().replace(/^@+/, '').replace(/[^a-z0-9_.-]/g, '');
    if (!clean || clean.length < 3) {
      setUsernameStatus(null);
      return;
    }
    setCheckingUsername(true);
    try {
      const res = await fetch(`/api/auth/username?username=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!data.available) {
        setUsernameStatus({ available: false, error: data.error || 'Username already taken.' });
      } else {
        setUsernameStatus({ available: true });
      }
    } catch {
      setUsernameStatus(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const supabase = getSupabase();

      if (mode === 'signup') {
        const cleanUname = username.toLowerCase().trim().replace(/^@+/, '').replace(/[^a-z0-9_.-]/g, '');
        if (!cleanUname || cleanUname.length < 3) {
          throw new Error('Username must be at least 3 characters long.');
        }

        // Verify username uniqueness
        const checkRes = await fetch(`/api/auth/username?username=${encodeURIComponent(cleanUname)}`);
        const checkData = await checkRes.json();
        if (!checkData.available) {
          throw new Error(checkData.error || `Username @${cleanUname} is already taken. Please choose another.`);
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanName = displayName.trim() || cleanUname;

        const { data: signUpData, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              username: cleanUname,
              display_name: cleanName,
              full_name: cleanName,
            },
          },
        });

        if (error) throw error;

        // Register username mapping for instant login resolution
        await fetch('/api/auth/username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUname,
            email: cleanEmail,
            displayName: cleanName,
            userId: signUpData.user?.id,
          }),
        }).catch(() => {});

        if (signUpData.session) {
          window.location.href = '/';
        } else {
          setMessage({
            type: 'success',
            text: 'Account created! Please check your email for a confirmation link to log in.',
          });
        }
      } else {
        // Sign In Mode: Support either username or email!
        const rawIdent = identifier.trim();
        if (!rawIdent) {
          throw new Error('Please enter your username or email.');
        }

        let loginEmail = rawIdent.toLowerCase();

        // If identifier does not look like an email, resolve username to email
        if (!rawIdent.includes('@') || !rawIdent.includes('.')) {
          const resolveRes = await fetch('/api/auth/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: rawIdent }),
          });

          const resolveData = await resolveRes.json();
          if (!resolveRes.ok || !resolveData.email) {
            throw new Error(
              resolveData.error ||
                `No account found with username @${rawIdent.replace(/^@+/, '')}. Please check or sign in with your email.`
            );
          }
          loginEmail = resolveData.email;
        }

        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

        if (error) {
          throw new Error('Incorrect credentials. Please check your username/email and password.');
        }

        // Self-heal oversized avatar if present
        if (signInData.user?.user_metadata?.avatar_url?.startsWith('data:')) {
          await supabase.auth.updateUser({
            data: { avatar_url: null },
          });
        }

        const searchParams = new URLSearchParams(window.location.search);
        const redirectTarget = searchParams.get('redirect') || searchParams.get('next') || '/';
        window.location.href = redirectTarget;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    const raw = identifier.trim() || email.trim();
    if (!raw) {
      setMessage({ type: 'error', text: 'Enter your username or email first.' });
      return;
    }
    setMessage(null);
    setLoading(true);

    try {
      let targetEmail = raw.toLowerCase();
      if (!raw.includes('@') || !raw.includes('.')) {
        const resolveRes = await fetch('/api/auth/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: raw }),
        });
        const resolveData = await resolveRes.json();
        if (!resolveRes.ok || !resolveData.email) {
          throw new Error(resolveData.error || `No account found with username @${raw}.`);
        }
        targetEmail = resolveData.email;
      }

      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setMessage({ type: 'success', text: `Magic link sent to ${targetEmail} — check your inbox.` });
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
    const searchParams = new URLSearchParams(window.location.search);
    const redirectTarget = searchParams.get('redirect') || searchParams.get('next');
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (redirectTarget) {
      callbackUrl.searchParams.set('next', redirectTarget);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
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
    <div className="min-h-dvh bg-canvas flex items-center justify-center px-4 font-sans">
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
                onClick={() => {
                  setMode(m);
                  setMessage(null);
                  setUsernameStatus(null);
                }}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors duration-150 cursor-pointer ${
                  mode === m
                    ? 'text-ink bg-surface font-semibold'
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
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-border rounded-xl text-sm font-medium text-ink hover:bg-surface transition-colors duration-150 disabled:opacity-50 cursor-pointer"
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
              {mode === 'signup' ? (
                <>
                  {/* Unique Username Input */}
                  <div>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs text-muted font-mono select-none">@</span>
                      <input
                        type="text"
                        id="signup-username-input"
                        value={username}
                        onChange={(e) => {
                          const val = e.target.value
                            .toLowerCase()
                            .replace(/^@+/, '')
                            .replace(/[^a-z0-9_.-]/g, '')
                            .slice(0, 30);
                          setUsername(val);
                          if (usernameStatus) setUsernameStatus(null);
                        }}
                        onBlur={() => handleCheckUsername(username)}
                        placeholder="choose a username (e.g. ananya)"
                        required
                        minLength={3}
                        maxLength={30}
                        className={`w-full pl-7 pr-8 py-2.5 text-sm font-mono bg-surface border rounded-xl text-ink placeholder:text-muted focus:outline-none transition-all ${
                          usernameStatus?.available === false
                            ? 'border-rose-400 bg-rose-50/20'
                            : usernameStatus?.available === true
                            ? 'border-emerald-400 bg-emerald-50/20'
                            : 'border-border focus:ring-1 focus:ring-ink/20 focus:border-ink/30'
                        }`}
                      />
                      <div className="absolute right-3 flex items-center pointer-events-none">
                        {checkingUsername ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
                        ) : usernameStatus?.available === true ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : usernameStatus?.available === false ? (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                        ) : null}
                      </div>
                    </div>
                    {usernameStatus?.error && (
                      <p className="text-[11px] text-rose-500 mt-1 pl-1">
                        {usernameStatus.error}
                      </p>
                    )}
                  </div>

                  {/* Display Name Input */}
                  <input
                    type="text"
                    id="display-name-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="display name (e.g. Ananya)"
                    required
                    maxLength={50}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-all"
                  />

                  {/* Email Input */}
                  <input
                    type="email"
                    id="email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-all"
                  />
                </>
              ) : (
                <>
                  {/* Sign In Identifier: Username or Email */}
                  <input
                    type="text"
                    id="identifier-input"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="username or email"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-all font-sans"
                  />
                </>
              )}

              {/* Password Input */}
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
                    className={`text-xs px-3 py-2 rounded-lg leading-relaxed ${
                      message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-600 border border-rose-200'
                    }`}
                  >
                    {message.text}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="submit"
                id="submit-auth-btn"
                disabled={loading || (mode === 'signup' && usernameStatus?.available === false)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-ink text-white text-sm font-semibold rounded-xl hover:bg-ink-light transition-colors duration-150 disabled:opacity-50 cursor-pointer shadow-soft"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    {mode === 'login' ? 'sign in' : 'create account'}
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>

              {mode === 'login' && (
                <button
                  type="button"
                  id="magic-link-btn"
                  onClick={handleMagicLink}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-border text-sm font-medium text-ink rounded-xl hover:bg-surface transition-colors duration-150 disabled:opacity-50 cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-muted" />
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
