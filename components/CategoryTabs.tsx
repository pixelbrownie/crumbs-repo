'use client';

import { CATEGORIES, type Category } from '@/types/crumb';
import { LayoutGroup, motion } from 'framer-motion';

interface CategoryTabsProps {
  active: Category;
  onChange: (category: Category) => void;
}

const LABELS: Record<Category, string> = {
  all: 'all',
  clothes: 'clothes',
  'shoes & accessories': 'shoes & accessories',
  'home & living': 'home & living',
  'tools & tech': 'tools & tech',
  misc: 'misc',
  curios: 'misc',
};

export default function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <LayoutGroup>
      <nav
        className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1"
        aria-label="Category filter"
      >
        {CATEGORIES.map((cat) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              id={`tab-${cat.replace(/[^a-z]/g, '-')}`}
              onClick={() => onChange(cat)}
              className={`relative px-3.5 py-1.5 text-sm font-medium whitespace-nowrap rounded-full transition-colors duration-200 ${
                isActive
                  ? 'text-ink font-semibold'
                  : 'text-muted hover:text-ink-light hover:bg-surface'
              }`}
            >
              {LABELS[cat]}
              {isActive && (
                <motion.span
                  layoutId="active-tab"
                  className="absolute inset-0 rounded-full -z-10 bg-ink/10"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {isActive && (
                <motion.span
                  layoutId="active-underline"
                  className="absolute bottom-0.5 left-3.5 right-3.5 h-[1.5px] bg-ink rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
