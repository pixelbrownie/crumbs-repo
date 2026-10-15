'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';
import type { User } from '@supabase/supabase-js';
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Key,
  ShieldCheck,
  ArrowLeft,
  ExternalLink,
  User as UserIcon,
  Camera,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

interface TokenItem {
  id: string;
  label: string;
  created_at: string;
  last_used_at?: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [createdRawToken, setCreatedRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
        const name =
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          '';
        setDisplayName(name);
        loadTokens();

        // Self-heal any user account with an oversized data-URI in user_metadata
        if (user.user_metadata?.avatar_url?.startsWith('data:')) {
          supabase.auth.updateUser({
            data: { avatar_url: null },
          }).then(({ data }) => {
            if (data?.user) setUser(data.user);
          });
        }
      }
    });
  }, [router, supabase]);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/capture/token');
      if (res.ok) {
        const { tokens } = await res.json();
        setTokens(tokens || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setSavingName(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      const clean = displayName.trim();
      const { data, error } = await supabase.auth.updateUser({
        data: {
          display_name: clean,
          full_name: clean,
        },
      });

      if (error) throw error;
      if (data.user) {
        setUser(data.user);
      }
      setProfileSuccess('Display name updated successfully.');
      setTimeout(() => setProfileSuccess(null), 3500);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please select a valid image file.');
      return;
    }

    setUploadingAvatar(true);
    setProfileSuccess(null);
    setProfileError(null);

    // Read and compress image to 256x256 square crop
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 256;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not process image');

          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

          canvas.toBlob(async (blob) => {
            if (!blob) {
              setProfileError('Could not process image blob');
              setUploadingAvatar(false);
              return;
            }

            try {
              const formData = new FormData();
              formData.append('file', blob, 'avatar.jpg');

              const res = await fetch('/api/user/avatar', {
                method: 'POST',
                body: formData,
              });

              const result = await res.json();
              if (!res.ok) {
                throw new Error(result.error || 'Failed to upload photo');
              }

              if (result.user) {
                setUser(result.user);
              }
              setProfileSuccess('Profile picture updated.');
              setTimeout(() => setProfileSuccess(null), 3500);
            } catch (postErr) {
              setProfileError(postErr instanceof Error ? postErr.message : 'Failed to upload photo');
            } finally {
              setUploadingAvatar(false);
            }
          }, 'image/jpeg', 0.85);
        } catch (err) {
          setProfileError(err instanceof Error ? err.message : 'Failed to update photo');
          setUploadingAvatar(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      const res = await fetch('/api/user/avatar', { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to remove photo');
      }

      if (result.user) {
        setUser(result.user);
      }
      setProfileSuccess('Profile picture removed.');
      setTimeout(() => setProfileSuccess(null), 3500);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to remove photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setTokenError(null);
    try {
      const res = await fetch('/api/capture/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim() || 'browser extension' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate token');

      setCreatedRawToken(data.token);
      setNewLabel('');
      loadTokens();
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Error generating token');
    }
  };

  const handleRevokeToken = async (id: string) => {
    if (!confirm('Revoke this capture token? Connected extensions using it will be disconnected.')) return;
    try {
      const res = await fetch(`/api/capture/token?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTokens((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rawAvatar = user?.user_metadata?.avatar_url as string | undefined;
  const avatarUrl = rawAvatar?.startsWith('data:') ? undefined : rawAvatar;
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="min-h-dvh bg-canvas">
      <Header user={user} activeCategory="all" onCategoryChange={() => router.push('/')} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to board
          </Link>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-sans font-semibold tracking-tight text-ink">settings</h1>
            <p className="text-xs text-muted mt-1">customize your profile, display name, and connections</p>
          </div>

          {/* 1. Profile & Identity Section */}
          <section className="bg-surface/50 border border-border rounded-3xl p-6 sm:p-7 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-ink-light" />
                profile
              </h2>
              <p className="text-xs text-muted mt-0.5">
                manage how your name and avatar appear across crumbs.
              </p>
            </div>

            {/* Profile Picture */}
            <div className="flex items-center gap-5 pt-1">
              <div className="relative group">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border border-border shadow-soft"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-ink text-canvas flex items-center justify-center font-semibold text-lg sm:text-xl shadow-soft">
                    {initials}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 p-1.5 bg-surface border border-border rounded-full text-ink shadow-sm hover:bg-surface-hover transition-colors"
                  title="Change photo"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="px-3 py-1.5 bg-ink text-canvas text-xs font-medium rounded-full hover:bg-ink-light transition-colors disabled:opacity-50"
                  >
                    change photo
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                      className="px-3 py-1.5 text-xs text-muted hover:text-rose-500 transition-colors"
                    >
                      remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted">
                  JPEG, PNG, or WebP. Auto-centered square crop.
                </p>
              </div>
            </div>

            {/* Display Name Form */}
            <form onSubmit={handleUpdateDisplayName} className="space-y-4 pt-2 border-t border-border/60">
              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">
                  display name
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="your name (e.g. ananya)"
                    maxLength={50}
                    required
                    className="flex-1 px-3.5 py-2 text-xs bg-canvas border border-border rounded-xl text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                  />
                  <button
                    type="submit"
                    disabled={savingName || !displayName.trim()}
                    className="px-4 py-2 bg-ink text-canvas text-xs font-medium rounded-xl hover:bg-ink-light transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>save name</span>
                  </button>
                </div>
                <p className="text-[11px] text-muted mt-1">
                  This is the only name shown on your boards. Your email remains private.
                </p>
              </div>

              {/* Account Email (Read-Only) */}
              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">
                  account email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3.5 py-2 text-xs bg-surface border border-border/60 rounded-xl text-muted cursor-not-allowed select-all"
                />
              </div>

              {/* Feedback messages */}
              {profileSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {profileError}
                </div>
              )}
            </form>
          </section>

          {/* 2. Capture Tokens Section */}
          <section className="bg-surface/50 border border-border rounded-3xl p-6 sm:p-7 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                  <Key className="w-4 h-4 text-ink-light" />
                  capture tokens
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  tokens allow the crumbs extension and mobile bookmarklet to securely save products to your board.
                </p>
              </div>
              <Link
                href="/capture"
                className="text-xs text-ink underline hover:text-ink-light flex items-center gap-1"
              >
                bookmarklet
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {/* Created Token Alert */}
            {createdRawToken && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    token generated — copy it now
                  </span>
                  <button
                    onClick={() => copyToClipboard(createdRawToken)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-emerald-600 text-canvas rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'copied!' : 'copy token'}
                  </button>
                </div>
                <div className="font-mono text-xs text-emerald-900 bg-white/70 p-2 rounded-xl border border-emerald-200 break-all select-all">
                  {createdRawToken}
                </div>
              </div>
            )}

            {/* Create Form */}
            <form onSubmit={handleCreateToken} className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="token label (e.g. phone or chrome)"
                className="flex-1 px-3.5 py-2 text-xs bg-canvas border border-border rounded-xl text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-ink text-canvas text-xs font-medium rounded-xl hover:bg-ink-light transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                generate token
              </button>
            </form>

            {tokenError && <p className="text-xs text-rose-500">{tokenError}</p>}

            {/* Token List */}
            <div className="space-y-2">
              {loading ? (
                <div className="text-xs text-muted py-4">loading tokens...</div>
              ) : tokens.length === 0 ? (
                <div className="text-xs text-muted py-4 text-center border border-dashed border-border rounded-xl">
                  no capture tokens yet. generate one above or connect via the extension.
                </div>
              ) : (
                tokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex items-center justify-between p-3 bg-canvas border border-border rounded-xl text-xs"
                  >
                    <div>
                      <div className="font-medium text-ink">{token.label}</div>
                      <div className="text-[11px] text-muted">
                        created {new Date(token.created_at).toLocaleDateString()}
                        {token.last_used_at && ` • last used ${new Date(token.last_used_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeToken(token.id)}
                      className="p-1.5 text-muted hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Revoke token"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 3. Extension Quick Connect */}
          <section className="bg-surface/50 border border-border rounded-3xl p-6 sm:p-7">
            <h2 className="text-base font-semibold text-ink">one-click browser connection</h2>
            <p className="text-xs text-muted mt-1 mb-4">
              if you have the crumbs chrome extension installed, connect it in one click without copying tokens manually.
            </p>
            <Link
              href="/connect"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface hover:bg-surface-hover border border-border rounded-xl text-xs font-medium text-ink transition-colors"
            >
              go to extension connection page
              <ExternalLink className="w-3 h-3" />
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
