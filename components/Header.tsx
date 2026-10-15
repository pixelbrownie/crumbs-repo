'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Category, Collection } from '@/types/crumb';
import CategoryTabs from './CategoryTabs';
import AuthButton from './AuthButton';
import type { User } from '@supabase/supabase-js';
import { Search, X, UserPlus, UserCheck, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  user: User | null;
  activeCategory: Category;
  onCategoryChange: (cat: Category) => void;
  customCategories?: string[];
  onAddCategory?: (name: string) => Promise<void> | void;
  onDeleteCategory?: (name: string) => Promise<void> | void;
  collections?: Collection[];
  activeCollection?: Collection | null;
  onSelectCollection?: (col: Collection | null) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

interface SearchedUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  followers_count: number;
  following_count: number;
  crumbs_count: number;
  is_following: boolean;
  is_self: boolean;
}

export default function Header({
  user,
  activeCategory,
  onCategoryChange,
  customCategories = [],
  onAddCategory,
  onDeleteCategory,
  collections = [],
  activeCollection = null,
  onSelectCollection,
  searchQuery = '',
  onSearchChange,
}: HeaderProps) {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [followLoadingMap, setFollowLoadingMap] = useState<Record<string, boolean>>({});

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search users debounced as query changes
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchedUsers([]);
      setIsSearchingUsers(false);
      setShowUserDropdown(false);
      return;
    }

    setShowUserDropdown(true);
    setIsSearchingUsers(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchedUsers(data.users || []);
        } else {
          setSearchedUsers([]);
        }
      } catch (err) {
        console.error('Failed to search users:', err);
        setSearchedUsers([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 220);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery]);

  const handleFollowToggle = async (e: React.MouseEvent, targetUser: SearchedUser) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push(`/login?redirect=/${targetUser.username}`);
      return;
    }

    if (followLoadingMap[targetUser.id]) return;

    setFollowLoadingMap((prev) => ({ ...prev, [targetUser.id]: true }));

    // Optimistic UI update
    const previousState = targetUser.is_following;
    setSearchedUsers((prev) =>
      prev.map((u) =>
        u.id === targetUser.id
          ? {
              ...u,
              is_following: !previousState,
              followers_count: previousState
                ? Math.max(0, u.followers_count - 1)
                : u.followers_count + 1,
            }
          : u
      )
    );

    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUser.id, action: 'toggle' }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Rollback
        setSearchedUsers((prev) =>
          prev.map((u) =>
            u.id === targetUser.id ? { ...u, is_following: previousState } : u
          )
        );
      } else if (typeof data.followers_count === 'number') {
        setSearchedUsers((prev) =>
          prev.map((u) =>
            u.id === targetUser.id
              ? { ...u, is_following: Boolean(data.is_following), followers_count: data.followers_count }
              : u
          )
        );
      }
    } catch {
      // Rollback
      setSearchedUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id ? { ...u, is_following: previousState } : u
        )
      );
    } finally {
      setFollowLoadingMap((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  };

  const handleSelectUser = (username: string) => {
    setShowUserDropdown(false);
    router.push(`/${username}`);
  };

  return (
    <header className="sticky top-0 z-40 bg-canvas/90 backdrop-blur-md border-b border-border transition-all">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-4 h-14">
          {/* Brand */}
          <Link href="/" className="flex-none flex flex-col leading-none select-none group">
            <span className="text-xl font-semibold tracking-tight text-ink font-sans group-hover:opacity-85 transition-opacity">
              crumbs
            </span>
            <span className="text-[10px] text-muted tracking-wide hidden sm:block">
              every piece you love.
            </span>
          </Link>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-border flex-none" />

          {/* Category tabs */}
          <div className="flex-1 min-w-0">
            <CategoryTabs
              active={activeCategory}
              onChange={onCategoryChange}
              customCategories={customCategories}
              onAddCategory={onAddCategory}
              onDeleteCategory={onDeleteCategory}
            />
          </div>

          {/* Search Toggle / Input */}
          <div ref={searchContainerRef} className="relative flex items-center gap-1.5 flex-none">
            {showSearch ? (
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim()) setShowUserDropdown(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowUserDropdown(false);
                      if (!searchQuery) setShowSearch(false);
                    }
                  }}
                  placeholder="search pieces, @username..."
                  autoFocus
                  className="w-48 sm:w-72 md:w-80 pl-8 pr-7 py-1.5 text-xs bg-surface border border-border/80 rounded-full text-ink placeholder:text-muted/70 focus:outline-none focus:border-ink/50 transition-all shadow-soft"
                />
                <button
                  onClick={() => {
                    onSearchChange?.('');
                    setShowUserDropdown(false);
                    setShowSearch(false);
                  }}
                  className="absolute right-2 p-0.5 text-muted hover:text-ink rounded-full cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* Profiles & Users Search Dropdown */}
                {showUserDropdown && searchQuery.trim().length > 0 && (
                  <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 max-h-96 overflow-y-auto bg-surface/98 backdrop-blur-xl border border-border rounded-2xl shadow-modal z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-border/50 text-[10px] uppercase tracking-wider text-muted font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-ink-light" />
                        profiles & creators
                      </span>
                      {isSearchingUsers && <Loader2 className="w-2.5 h-2.5 animate-spin text-muted" />}
                    </div>

                    <div className="py-1 space-y-0.5">
                      {searchedUsers.length > 0 ? (
                        searchedUsers.map((u) => {
                          const initials = (u.display_name || u.username).slice(0, 2).toUpperCase();
                          const isFollowLoading = followLoadingMap[u.id];

                          return (
                            <div
                              key={u.id}
                              onClick={() => handleSelectUser(u.username)}
                              className="group flex items-center justify-between p-2 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-ink/5 border border-border/60 flex items-center justify-center shrink-0">
                                  {u.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={u.avatar_url}
                                      alt={u.display_name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-semibold text-ink-light">
                                      {initials}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 text-left">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-semibold text-ink truncate group-hover:underline">
                                      {u.display_name}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted truncate">
                                    @{u.username} · {u.crumbs_count} crumbs · {u.followers_count} {u.followers_count === 1 ? 'follower' : 'followers'}
                                  </div>
                                </div>
                              </div>

                              {/* Follow / Unfollow Button */}
                              {u.is_self ? (
                                <span className="text-[10px] text-muted px-2 py-0.5 bg-surface rounded-full border border-border shrink-0">
                                  you
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleFollowToggle(e, u)}
                                  disabled={isFollowLoading}
                                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full transition-all cursor-pointer ${
                                    u.is_following
                                      ? 'bg-surface hover:bg-surface-hover text-ink border border-border shadow-none'
                                      : 'bg-ink text-white hover:bg-ink-light shadow-soft'
                                  }`}
                                >
                                  {u.is_following ? (
                                    <>
                                      <UserCheck className="w-3 h-3 text-emerald-600" />
                                      <span>following</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserPlus className="w-3 h-3" />
                                      <span>follow</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })
                      ) : !isSearchingUsers ? (
                        <div className="px-3 py-4 text-center text-xs text-muted">
                          no profiles found for &ldquo;{searchQuery}&rdquo;
                        </div>
                      ) : (
                        <div className="px-3 py-4 text-center text-xs text-muted flex items-center justify-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
                          <span>searching creators...</span>
                        </div>
                      )}
                    </div>

                    <div className="px-2.5 py-1.5 border-t border-border/50 text-[10px] text-muted text-center bg-surface/50 rounded-b-xl">
                      press Enter or view board pieces below
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                title="Search crumbs & users"
                className="p-2 text-muted hover:text-ink hover:bg-surface rounded-full transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {/* User Auth */}
            <AuthButton user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}
