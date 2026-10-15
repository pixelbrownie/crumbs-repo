'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthButtonProps {
  user: SupabaseUser | null;
}

export default function AuthButton({ user }: AuthButtonProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const { createClient } = require('@/lib/supabase');
    const supabase = createClient();
    await supabase.auth.signOut();
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
          className="px-3.5 py-1.5 text-sm font-semibold text-canvas bg-ink rounded-full hover:bg-ink-light transition-colors"
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

  const initials = displayName.slice(0, 2).toUpperCase();
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Link
        href="/settings"
        title="View profile & settings"
        className="flex items-center gap-2 pl-2 sm:pl-2.5 pr-2.5 sm:pr-3 py-1 sm:py-1.5 rounded-full bg-surface hover:bg-surface-hover border border-border transition-colors group cursor-pointer select-none"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-ink flex items-center justify-center">
            <span className="text-[10px] font-semibold text-canvas">{initials}</span>
          </div>
        )}
        <span className="text-xs text-ink font-medium max-w-[100px] sm:max-w-[130px] truncate">
          {displayName}
        </span>
      </Link>

      <button
        onClick={handleLogout}
        title="Sign out"
        id="logout-btn"
        className="p-1.5 sm:p-2 rounded-full text-muted hover:text-ink hover:bg-surface transition-colors duration-150"
      >
        <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
}
