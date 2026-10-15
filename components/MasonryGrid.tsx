'use client';

import { AnimatePresence, motion } from 'framer-motion';
import CrumbCard from './CrumbCard';
import type { Crumb } from '@/types/crumb';

interface MasonryGridProps {
  crumbs: Crumb[];
  onDelete?: (id: string) => void;
  onUpdate?: (crumb: Crumb) => void;
  readOnly?: boolean;
}

export default function MasonryGrid({
  crumbs,
  onDelete,
  onUpdate,
  readOnly = false,
}: MasonryGridProps) {
  if (crumbs.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center py-32 px-4 text-center"
      >
        <div className="w-16 h-16 mb-6 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-soft">
          <span className="text-2xl">🍞</span>
        </div>
        <p className="text-ink font-medium mb-1">no crumbs here yet.</p>
        <p className="text-muted text-sm">hit the + to start adding pieces you love.</p>
      </motion.div>
    );
  }

  return (
    <div
      className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-3 sm:gap-4 column-fill-balance w-full"
      style={{
        columnGap: '1rem',
      }}
    >
      <AnimatePresence mode="popLayout">
        {crumbs.map((crumb) => (
          <CrumbCard
            key={crumb.id}
            crumb={crumb}
            onDelete={onDelete}
            onUpdate={onUpdate}
            readOnly={readOnly}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
