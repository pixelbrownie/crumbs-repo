'use client';

import { useState } from 'react';
import type { Category, Collection } from '@/types/crumb';
import CategoryTabs from './CategoryTabs';
import AuthButton from './AuthButton';
import type { User } from '@supabase/supabase-js';
import { Search, X } from 'lucide-react';
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
  const [showSearch, setShowSearch] = useState(false);

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
          <div className="flex items-center gap-1.5 flex-none">
            {showSearch ? (
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder="search pieces, brands, tags..."
                  autoFocus
                  className="w-40 sm:w-60 pl-8 pr-7 py-1.5 text-xs bg-surface border border-border/70 rounded-full text-ink placeholder:text-muted/70 focus:outline-none focus:border-ink/50"
                />
                <button
                  onClick={() => {
                    onSearchChange?.('');
                    setShowSearch(false);
                  }}
                  className="absolute right-2 p-0.5 text-muted hover:text-ink rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                title="Search crumbs"
                className="p-2 text-muted hover:text-ink hover:bg-surface rounded-full transition-colors"
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
