'use client';

import type { Category } from '@/types/crumb';
import CategoryTabs from './CategoryTabs';
import AuthButton from './AuthButton';
import type { User } from '@supabase/supabase-js';

interface HeaderProps {
  user: User | null;
  activeCategory: Category;
  onCategoryChange: (cat: Category) => void;
}

export default function Header({ user, activeCategory, onCategoryChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-canvas/90 backdrop-blur-md border-b border-border">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 h-14">
          {/* Brand */}
          <div className="flex-none">
            <div className="flex flex-col leading-none">
              <span className="text-xl font-semibold tracking-tight text-ink font-sans">
                crumbs
              </span>
              <span className="text-[10px] text-muted tracking-wide hidden sm:block">
                every piece you love.
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-border flex-none" />

          {/* Category tabs — take remaining space */}
          <div className="flex-1 min-w-0">
            <CategoryTabs active={activeCategory} onChange={onCategoryChange} />
          </div>

          {/* Auth */}
          <div className="flex-none">
            <AuthButton user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}
