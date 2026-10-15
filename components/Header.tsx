'use client';

import { useState } from 'react';
import type { Category, Collection } from '@/types/crumb';
import CategoryTabs from './CategoryTabs';
import AuthButton from './AuthButton';
import type { User } from '@supabase/supabase-js';
import { Search, X, Sparkles, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  user: User | null;
  activeCategory: Category;
  onCategoryChange: (cat: Category) => void;
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
  collections = [],
  activeCollection = null,
  onSelectCollection,
  searchQuery = '',
  onSearchChange,
}: HeaderProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [showBoards, setShowBoards] = useState(false);

  // Filter smart boards with >= 2 items
  const smartBoards = collections.filter(
    (c) => (c.item_count || (c as any).count || 0) >= 2
  );

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

          {/* Category tabs — take center/remaining space */}
          <div className="flex-1 min-w-0">
            <CategoryTabs active={activeCategory} onChange={onCategoryChange} />
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

            {/* Smart boards toggle if user has boards */}
            {smartBoards.length > 0 && (
              <button
                onClick={() => setShowBoards(!showBoards)}
                title="Smart Boards"
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full border transition-all ${
                  showBoards || activeCollection
                    ? 'bg-ink text-paper border-ink'
                    : 'border-border/60 text-ink/80 hover:bg-surface'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span className="hidden md:inline">boards</span>
                {smartBoards.length > 0 && (
                  <span className="text-[10px] opacity-75 font-mono">
                    {smartBoards.length}
                  </span>
                )}
              </button>
            )}

            {/* User Auth */}
            <AuthButton user={user} />
          </div>
        </div>

        {/* Smart Boards Strip */}
        {(showBoards || activeCollection) && smartBoards.length > 0 && (
          <div className="py-2.5 border-t border-border/40 flex items-center gap-2 overflow-x-auto scrollbar-hide animate-in fade-in duration-200">
            <span className="text-[11px] uppercase tracking-wider text-muted font-medium flex items-center gap-1 pl-1 flex-none">
              <SlidersHorizontal className="w-3 h-3" />
              smart boards:
            </span>

            {smartBoards.map((col) => {
              const count = col.item_count || (col as any).count || 0;
              const isSelected = activeCollection?.id === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => {
                    if (isSelected) {
                      onSelectCollection?.(null);
                    } else {
                      onSelectCollection?.(col);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-ink text-paper border-ink shadow-soft'
                      : 'bg-surface hover:bg-surface-hover text-ink/80 border-border/60'
                  }`}
                >
                  <span>{col.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? 'bg-paper/20 text-paper'
                        : 'bg-canvas text-muted border border-border/40'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {activeCollection && (
              <button
                onClick={() => onSelectCollection?.(null)}
                className="text-[11px] text-muted hover:text-ink underline ml-1 flex-none"
              >
                clear board filter
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
