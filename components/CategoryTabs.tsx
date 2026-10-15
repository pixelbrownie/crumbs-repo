'use client';

import { useState, useRef, useEffect } from 'react';
import { CATEGORIES, type Category } from '@/types/crumb';
import { LayoutGroup, motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, X } from 'lucide-react';

interface CategoryTabsProps {
  active: Category;
  onChange: (category: Category) => void;
  customCategories?: string[];
  onAddCategory?: (name: string) => Promise<void> | void;
  onDeleteCategory?: (name: string) => Promise<void> | void;
}

const LABELS: Record<string, string> = {
  all: 'all',
  clothes: 'clothes',
  'shoes & accessories': 'shoes & accessories',
  'home & living': 'home & living',
  'tools & tech': 'tools & tech',
  misc: 'misc',
  curios: 'misc',
};

export default function CategoryTabs({
  active,
  onChange,
  customCategories = [],
  onAddCategory,
  onDeleteCategory,
}: CategoryTabsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleStartAdd = () => {
    setIsAdding(true);
    setNewBoardName('');
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewBoardName('');
  };

  const handleSubmitAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newBoardName.trim().toLowerCase();
    if (!clean || clean.length < 2 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (onAddCategory) {
        await onAddCategory(clean);
      }
      setIsAdding(false);
      setNewBoardName('');
    } catch (err) {
      console.error('Failed to create board:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter out any custom categories that duplicate default ones
  const filteredCustom = customCategories.filter(
    (c) => c && !CATEGORIES.includes(c as any) && c !== 'curios'
  );

  return (
    <LayoutGroup>
      <nav
        className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1"
        aria-label="Category and board filter"
      >
        {/* Standard categories */}
        {CATEGORIES.map((cat) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              id={`tab-${cat.replace(/[^a-z]/g, '-')}`}
              onClick={() => onChange(cat)}
              className={`relative px-3.5 py-1.5 text-sm font-medium whitespace-nowrap rounded-full transition-colors duration-200 cursor-pointer ${
                isActive
                  ? 'text-ink font-semibold'
                  : 'text-muted hover:text-ink-light hover:bg-surface'
              }`}
            >
              {LABELS[cat] || cat}
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

        {/* Subtle divider if custom boards exist */}
        {filteredCustom.length > 0 && (
          <div className="w-px h-3.5 bg-border/80 mx-1 flex-none" />
        )}

        {/* User's custom boards */}
        {filteredCustom.map((customCat) => {
          const isActive = active === customCat;
          return (
            <div
              key={customCat}
              className="relative inline-flex items-center group flex-none"
            >
              <button
                id={`tab-${customCat.replace(/[^a-z0-9]/g, '-')}`}
                onClick={() => onChange(customCat)}
                className={`relative px-3.5 py-1.5 text-sm font-medium whitespace-nowrap rounded-full transition-colors duration-200 cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'text-ink font-semibold'
                    : 'text-muted hover:text-ink-light hover:bg-surface'
                }`}
              >
                <span>{customCat}</span>
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

              {/* Delete custom board button (on hover or active) */}
              {onDeleteCategory && (
                <button
                  type="button"
                  title={`Delete board "${customCat}"`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      window.confirm(
                        `Delete board "${customCat}"? Crumbs in this board will be kept in misc.`
                      )
                    ) {
                      onDeleteCategory(customCat);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity -ml-1 mr-1 p-0.5 text-muted hover:text-rose-600 rounded-full cursor-pointer hover:bg-rose-50"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add custom board button / inline input */}
        {onAddCategory && (
          <div className="flex-none ml-0.5">
            <AnimatePresence mode="wait">
              {isAdding ? (
                <motion.form
                  key="add-form"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onSubmit={handleSubmitAdd}
                  className="inline-flex items-center gap-1 bg-surface border border-ink/30 px-2 py-0.5 rounded-full shadow-soft"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') handleCancelAdd();
                    }}
                    placeholder="board name..."
                    maxLength={30}
                    disabled={isSubmitting}
                    className="text-xs bg-transparent border-none text-ink placeholder:text-muted/60 focus:outline-none w-24 sm:w-28 py-1"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || newBoardName.trim().length < 2}
                    title="Create board"
                    className="p-1 rounded-full bg-ink text-white hover:bg-ink/90 disabled:opacity-40 transition-opacity cursor-pointer"
                  >
                    <Check className="w-2.5 h-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAdd}
                    title="Cancel"
                    className="p-1 text-muted hover:text-ink rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </motion.form>
              ) : (
                <motion.button
                  key="add-button"
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={handleStartAdd}
                  title="Create custom board"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted hover:text-ink border border-dashed border-border hover:border-ink/40 rounded-full transition-all hover:bg-surface cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3 h-3 text-muted hover:text-ink" />
                  <span>new board</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </nav>
    </LayoutGroup>
  );
}
