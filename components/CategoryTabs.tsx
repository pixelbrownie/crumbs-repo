'use client';

import { AI_CATEGORIES, type Category, type Collection } from '@/types/crumb';
import { LayoutGroup, motion } from 'framer-motion';

interface CategoryTabsProps {
  active: Category;
  onChange: (category: Category) => void;
  collections?: Collection[];
  activeCollection?: Collection | null;
  onSelectCollection?: (col: Collection | null) => void;
}

const LABELS: Record<Category, string> = {
  all: 'all',
  clothes: 'clothes',
  'shoes & accessories': 'shoes & accessories',
  'home & living': 'home & living',
  'tools & tech': 'tools & tech',
  curios: 'curios',
};

export default function CategoryTabs({
  active,
  onChange,
  collections = [],
  activeCollection = null,
  onSelectCollection,
}: CategoryTabsProps) {
  // Dynamic smart boards with >= 2 items (aesthetics, brands, colors) excluding category boards
  const extraBoards = collections.filter(
    (c) => c.kind !== 'category' && ((c.count || (c as any).item_count || 0) >= 2)
  );

  const isAllActive = active === 'all' && !activeCollection;

  return (
    <LayoutGroup>
      <nav
        className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1"
        aria-label="Category and smart boards filter"
      >
        {/* "all" tab */}
        <button
          id="tab-all"
          onClick={() => {
            onChange('all');
            onSelectCollection?.(null);
          }}
          className={`relative px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-full transition-colors duration-200 ${
            isAllActive
              ? 'text-ink font-semibold'
              : 'text-muted hover:text-ink-light hover:bg-surface'
          }`}
        >
          all
          {isAllActive && (
            <motion.span
              layoutId="active-tab"
              className="absolute inset-0 rounded-full -z-10"
              style={{ backgroundColor: 'rgba(28,26,23,0.08)' }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          {isAllActive && (
            <motion.span
              layoutId="active-underline"
              className="absolute bottom-0.5 left-3 right-3 h-[1.5px] bg-ink rounded-full"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        {/* "smart boards:" label immediately after "all" */}
        <div className="flex items-center gap-1.5 pl-2 pr-1 select-none flex-none">
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="text-xs text-muted/70 font-medium tracking-wide">
            smart boards:
          </span>
        </div>

        {/* AI-categorized smart boards (clothes, shoes & accessories, etc.) */}
        {AI_CATEGORIES.map((cat) => {
          const isActive = active === cat && !activeCollection;
          return (
            <button
              key={cat}
              id={`tab-${cat.replace(/[^a-z]/g, '-')}`}
              onClick={() => {
                onChange(cat);
                onSelectCollection?.(null);
              }}
              className={`relative px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-full transition-colors duration-200 ${
                isActive
                  ? 'text-ink font-semibold'
                  : 'text-muted hover:text-ink-light hover:bg-surface'
              }`}
            >
              {LABELS[cat]}
              {isActive && (
                <motion.span
                  layoutId="active-tab"
                  className="absolute inset-0 rounded-full -z-10"
                  style={{ backgroundColor: 'rgba(28,26,23,0.08)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {isActive && (
                <motion.span
                  layoutId="active-underline"
                  className="absolute bottom-0.5 left-3 right-3 h-[1.5px] bg-ink rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}

        {/* Dynamic smart collections (aesthetic, brand, color with >= 2 pieces) */}
        {extraBoards.map((col) => {
          const isSelected = activeCollection?.id === col.id;
          const count = col.count || (col as any).item_count || 0;
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
              className={`relative px-2.5 py-1 text-xs font-medium whitespace-nowrap rounded-full transition-all flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-ink text-paper border-ink shadow-soft'
                  : 'bg-surface hover:bg-surface-hover text-ink/80 border-border/60'
              }`}
            >
              <span>{col.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
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
      </nav>
    </LayoutGroup>
  );
}
