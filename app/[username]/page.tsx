'use client';

export const dynamic = 'force-dynamic';

import { use, useState, useEffect, useMemo } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';
import MasonryGrid from '@/components/MasonryGrid';
import CategoryTabs from '@/components/CategoryTabs';
import type { Crumb, Category } from '@/types/crumb';
import type { User } from '@supabase/supabase-js';
import {
  Share2,
  Check,
  Lock,
  Edit3,
  ExternalLink,
  Sparkles,
  Users,
  Grid,
} from 'lucide-react';
import Link from 'next/link';

interface ProfileData {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string;
  is_public: boolean;
  followers_count: number;
  following_count: number;
}

const RESERVED = new Set([
  'login',
  'signup',
  'settings',
  'share',
  'capture',
  'connect',
  'privacy',
  'api',
  'auth',
  '_next',
  'favicon.ico',
]);

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = use(params);
  const router = useRouter();

  // Clean username
  const cleanUsername = rawUsername.toLowerCase().trim().replace(/^@+/, '');

  if (RESERVED.has(cleanUsername)) {
    notFound();
  }

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [crumbsCount, setCrumbsCount] = useState<number>(0);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [copied, setCopied] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/profile/${cleanUsername}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('User not found');
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load profile');
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setProfile(data.profile);
        setCrumbs(data.crumbs || []);
        setCrumbsCount(data.crumbsCount ?? data.crumbs?.length ?? 0);
        setIsOwner(Boolean(data.isOwner));
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cleanUsername]);

  const handleShareProfile = async () => {
    const profileUrl = typeof window !== 'undefined' ? window.location.href : `https://crumbsbypixel.vercel.app/${cleanUsername}`;
    const title = `${profile?.display_name || cleanUsername}'s curated pieces on crumbs`;

    if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title,
          url: profileUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  // Filter crumbs by selected category
  const filteredCrumbs = useMemo(() => {
    if (activeCategory === 'all') return crumbs;
    return crumbs.filter((c) => c.category === activeCategory);
  }, [crumbs, activeCategory]);

  const displayName = profile?.display_name || cleanUsername;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-dvh bg-canvas text-ink flex flex-col selection:bg-ink selection:text-paper font-sans">
      <Header
        user={currentUser}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-20 h-20 rounded-full bg-surface animate-pulse" />
            <div className="w-32 h-4 rounded-full bg-surface animate-pulse" />
            <div className="w-48 h-3 rounded-full bg-surface animate-pulse" />
          </div>
        ) : error || !profile ? (
          <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-soft text-2xl">
              🔍
            </div>
            <h1 className="text-lg font-semibold text-ink">user not found</h1>
            <p className="text-xs text-muted mt-1 max-w-sm">
              We couldn&apos;t find anyone with the handle @{cleanUsername}.
            </p>
            <Link
              href="/"
              className="mt-5 px-4 py-2 bg-ink text-white text-xs font-semibold rounded-full hover:bg-ink-light transition-colors shadow-soft"
            >
              back to crumbs
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Profile Hero Header Card */}
            <div className="max-w-2xl mx-auto flex flex-col items-center text-center px-4">
              {/* Profile Picture */}
              <div className="relative mb-3.5">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shrink-0 border border-border/80 shadow-soft bg-surface flex items-center justify-center aspect-square">
                  {profile.avatar_url && !avatarError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      onError={() => setAvatarError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl sm:text-2xl font-semibold text-ink/80 tracking-tight">
                      {initials}
                    </span>
                  )}
                </div>
              </div>

              {/* Display Name & Handle */}
              <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight font-sans">
                {displayName}
              </h1>
              <p className="text-xs text-muted font-mono tracking-tight mt-0.5">
                @{profile.username}
              </p>

              {/* Bio */}
              {profile.bio && (
                <p className="text-xs sm:text-sm text-ink-light max-w-md mt-2.5 leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* Stats Bar */}
              <div className="flex items-center gap-4 sm:gap-6 mt-4 py-2 px-5 bg-surface border border-border/70 rounded-full shadow-soft text-xs">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <span className="font-semibold text-ink">{crumbsCount}</span>
                  <span className="text-muted">crumbs</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-border" />
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <span className="font-semibold text-ink">{profile.followers_count || 0}</span>
                  <span className="text-muted">followers</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-border" />
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <span className="font-semibold text-ink">{profile.following_count || 0}</span>
                  <span className="text-muted">following</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleShareProfile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-white text-xs font-semibold rounded-full hover:bg-ink-light transition-all shadow-soft cursor-pointer active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>link copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>share profile</span>
                    </>
                  )}
                </button>

                {isOwner && (
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-surface hover:bg-surface-hover text-ink border border-border text-xs font-medium rounded-full transition-colors shadow-soft"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-muted" />
                    <span>edit profile</span>
                  </Link>
                )}
              </div>

              {/* Private notice for owner */}
              {isOwner && !profile.is_public && (
                <div className="mt-4 p-2.5 px-4 bg-amber-50 border border-amber-200/80 rounded-2xl text-[11px] text-amber-800 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>
                    Your saved pieces are currently private. Turn on &ldquo;Display crumbs publicly&rdquo; in{' '}
                    <Link href="/settings" className="underline font-semibold">
                      Settings
                    </Link>{' '}
                    to let others view them.
                  </span>
                </div>
              )}
            </div>

            {/* Pieces Section */}
            <div className="pt-4 space-y-4">
              {!profile.is_public && !isOwner ? (
                <div className="max-w-md mx-auto py-20 px-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-surface border border-border flex items-center justify-center text-muted">
                    <Lock className="w-5 h-5 text-muted" />
                  </div>
                  <h3 className="text-sm font-semibold text-ink">this archive is private</h3>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    @{profile.username} has chosen to keep their saved crumbs private.
                  </p>
                </div>
              ) : (
                <>
                  {crumbs.length > 0 && (
                    <div className="flex items-center justify-center">
                      <CategoryTabs
                        active={activeCategory}
                        onChange={setActiveCategory}
                      />
                    </div>
                  )}

                  <MasonryGrid
                    crumbs={filteredCrumbs}
                    readOnly={!isOwner}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
