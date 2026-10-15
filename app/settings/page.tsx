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
  Share2,
  Globe,
  Lock,
  AtSign,
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
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [copiedProfileLink, setCopiedProfileLink] = useState(false);
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

        const initialUname = (
          user.user_metadata?.username ||
          user.user_metadata?.display_name ||
          user.email?.split('@')[0] ||
          'user'
        )
          .toLowerCase()
          .replace(/^@+/, '')
          .replace(/[^a-z0-9_.-]/g, '');
        setUsername(initialUname);
        setBio(user.user_metadata?.bio || '');
        setIsPublic(user.user_metadata?.is_public !== false);

        loadTokens();

        // Fetch full profile if exists
        fetch('/api/profile')
          .then((res) => res.json())
          .then((data) => {
            if (data.profile) {
              if (data.profile.username) setUsername(data.profile.username);
              if (data.profile.display_name) setDisplayName(data.profile.display_name);
              if (data.profile.bio !== undefined) setBio(data.profile.bio || '');
              if (data.profile.is_public !== undefined) setIsPublic(data.profile.is_public !== false);
            }
          })
          .catch(() => {});

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUname = username.trim().toLowerCase().replace(/^@+/, '');
    if (!cleanUname || !displayName.trim()) {
      setProfileError('Please provide both a username and display name.');
      return;
    }

    setSavingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUname,
          display_name: displayName.trim(),
          bio: bio.trim(),
          is_public: isPublic,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      if (data.profile) {
        setUsername(data.profile.username);
        setDisplayName(data.profile.display_name);
        setBio(data.profile.bio || '');
        setIsPublic(data.profile.is_public !== false);
      }

      const { data: updatedAuth } = await supabase.auth.getUser();
      if (updatedAuth?.user) setUser(updatedAuth.user);

      setProfileSuccess('Profile & handle updated successfully.');
      setTimeout(() => setProfileSuccess(null), 3500);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
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

    // Read and compress image to 180x180 square crop with 0.78 quality
    // Keeps avatar ultra-lightweight (< 20KB) so it never bloats bandwidth or page layout
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 180;
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
          }, 'image/jpeg', 0.78);
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

            {/* Public Profile Link Bar */}
            <div className="p-4 bg-canvas/80 border border-border/70 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted flex items-center gap-1.5 mb-0.5">
                  <Globe className="w-3 h-3 text-ink-light" />
                  your public profile link
                </span>
                <p className="text-xs font-mono font-medium text-ink truncate select-all">
                  https://crumbsbypixel.vercel.app/{username || 'username'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-none">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://crumbsbypixel.vercel.app/${username}`);
                    setCopiedProfileLink(true);
                    setTimeout(() => setCopiedProfileLink(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-full text-xs font-medium text-ink transition-colors flex items-center gap-1.5 shadow-soft cursor-pointer"
                >
                  {copiedProfileLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-muted" />
                      <span>copy link</span>
                    </>
                  )}
                </button>

                <Link
                  href={`/${username}`}
                  target="_blank"
                  className="p-1.5 bg-surface hover:bg-surface-hover border border-border rounded-full text-muted hover:text-ink transition-colors"
                  title="View profile"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Profile Picture */}
            <div className="flex items-center gap-5 pt-1">
              <div className="relative group shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0 border border-border shadow-soft bg-surface flex items-center justify-center aspect-square">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-semibold text-lg sm:text-xl text-ink">
                      {initials}
                    </span>
                  )}
                </div>

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
                    className="px-3 py-1.5 bg-ink text-white text-xs font-medium rounded-full hover:bg-ink-light transition-colors disabled:opacity-50"
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
                  JPEG, PNG, or WebP. Automatically resized and optimized.
                </p>
              </div>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSaveProfile} className="space-y-4 pt-2 border-t border-border/60">
              {/* Username Field */}
              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">
                  username handle
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs text-muted font-mono select-none">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value
                          .toLowerCase()
                          .replace(/^@+/, '')
                          .replace(/[^a-z0-9_.-]/g, '')
                          .slice(0, 30)
                      )
                    }
                    placeholder="username (e.g. ananya)"
                    maxLength={30}
                    required
                    className="w-full pl-7 pr-3.5 py-2 text-xs font-mono bg-canvas border border-border rounded-xl text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                  />
                </div>
                <p className="text-[11px] text-muted mt-1">
                  Letters, numbers, dots, dashes, and underscores only.
                </p>
              </div>

              {/* Display Name Field */}
              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">
                  display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="your name (e.g. Ananya)"
                  maxLength={50}
                  required
                  className="w-full px-3.5 py-2 text-xs bg-canvas border border-border rounded-xl text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                />
              </div>

              {/* Bio Field */}
              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">
                  bio <span className="text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 160))}
                  placeholder="a brief note about your style or curated pieces..."
                  rows={2}
                  maxLength={160}
                  className="w-full px-3.5 py-2 text-xs bg-canvas border border-border rounded-xl text-ink focus:outline-none focus:ring-1 focus:ring-ink/20 resize-none"
                />
                <div className="flex justify-end text-[10px] text-muted mt-0.5">
                  {bio.length}/160
                </div>
              </div>

              {/* Display Crumbs Publicly Toggle */}
              <div className="p-3.5 bg-canvas/60 border border-border/80 rounded-2xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-ink">
                      display saved pieces publicly
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    When enabled, anyone visiting your profile link can view your saved pieces.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-none">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-ink"></div>
                </label>
              </div>

              {/* Save Button */}
              <div className="pt-1 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingProfile || !displayName.trim() || !username.trim()}
                  className="px-5 py-2.5 bg-ink text-white text-xs font-semibold rounded-xl hover:bg-ink-light transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-soft cursor-pointer"
                >
                  {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>save profile changes</span>
                </button>
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
