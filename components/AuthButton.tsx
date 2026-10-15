'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon, Settings, ChevronDown, ExternalLink, Link2 } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthButtonProps {
  user: SupabaseUser | null;
}

export default function AuthButton({ user }: AuthButtonProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    const { createClient } = require('@/lib/supabase');
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push('/login');
    router.refresh();
  };

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/login"
          id="header-login-link"
          className="px-3 py-1.5 text-sm font-medium text-muted hover:text-ink transition-colors"
        >
          login
        </Link>
        <Link
          href="/login?mode=signup"
          id="header-signup-link"
          className="px-3.5 py-1.5 text-sm font-semibold text-white bg-ink rounded-full hover:bg-ink-light transition-colors"
        >
          sign up
        </Link>
      </div>
    );
  }

  // Show only display name (never expose raw email address on UI)
  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'you';

  const username = (
    user.user_metadata?.username ||
    user.user_metadata?.display_name ||
    user.email?.split('@')[0] ||
    'user'
  )
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_.-]/g, '');

  const initials = displayName.slice(0, 2).toUpperCase();
  const rawAvatar = user.user_metadata?.avatar_url as string | undefined;
  const avatarUrl = rawAvatar?.startsWith('data:') ? undefined : rawAvatar;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        title="Account & Profile"
        className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1 sm:py-1.5 rounded-full bg-surface hover:bg-surface-hover border border-border transition-colors group cursor-pointer select-none"
      >
        <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-ink flex items-center justify-center aspect-square">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[10px] font-semibold text-white">{initials}</span>
          )}
        </div>
        <span className="text-xs text-ink font-medium max-w-[85px] sm:max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-muted transition-transform duration-200 ${
            menuOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Profile & Account Dropdown Menu */}
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 p-1.5 bg-surface border border-border rounded-2xl shadow-card z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-0.5 font-sans">
          {/* Header section with username */}
          <Link
            href={`/${username}`}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-hover transition-colors group"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-ink flex items-center justify-center aspect-square">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-white">{initials}</span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-ink truncate group-hover:underline">
                {displayName}
              </span>
              <span className="text-[10px] text-muted font-mono truncate">
                @{username}
              </span>
            </div>
          </Link>

          <div className="h-px bg-border/60 my-1" />

          {/* Menu links */}
          <Link
            href={`/${username}`}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-ink hover:bg-surface-hover rounded-xl transition-colors"
          >
            <UserIcon className="w-3.5 h-3.5 text-muted" />
            <span>view profile & crumbs</span>
          </Link>

          <Link
            href="/settings"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-ink hover:bg-surface-hover rounded-xl transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-muted" />
            <span>settings & account</span>
          </Link>

          <Link
            href="/connect"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-ink hover:bg-surface-hover rounded-xl transition-colors"
          >
            <Link2 className="w-3.5 h-3.5 text-muted" />
            <span>connect extension</span>
          </Link>

          <div className="h-px bg-border/60 my-1" />

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors w-full text-left cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
