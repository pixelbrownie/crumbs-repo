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

  const initials = user.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'U';

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2.5 pl-3 pr-1.5 py-1.5 rounded-full bg-surface border border-border">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="avatar"
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-ink flex items-center justify-center">
            <span className="text-[10px] font-semibold text-canvas">{initials}</span>
          </div>
        )}
        <span className="text-xs text-ink-light font-medium hidden sm:block max-w-[120px] truncate">
          {user.email}
        </span>
      </div>

      <button
        onClick={handleLogout}
        title="Sign out"
        id="logout-btn"
        className="p-2 rounded-full text-muted hover:text-ink hover:bg-surface transition-colors duration-150"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
