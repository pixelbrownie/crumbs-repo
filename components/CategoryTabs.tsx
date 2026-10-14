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
  'body & skin': 'body & skin',
  'home & living': 'home & living',
  'tools & tech': 'tools & tech',
  curios: 'curios',
};

export default function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <LayoutGroup>
      <nav
        className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide"
        aria-label="Category filter"
      >
        {CATEGORIES.map((cat) => {
          const isActive = cat === active;
          return (
            <button
              key={cat}
              id={`tab-${cat.replace(/[^a-z]/g, '-')}`}
              onClick={() => onChange(cat)}
              className={`relative px-3.5 py-1.5 text-sm font-medium whitespace-nowrap rounded-full transition-colors duration-200 ${
                isActive
                  ? 'text-ink'
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
