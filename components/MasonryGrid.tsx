'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Masonry from 'react-masonry-css';
import CrumbCard from './CrumbCard';
import type { Crumb } from '@/types/crumb';

interface MasonryGridProps {
  crumbs: Crumb[];
  onDelete?: (id: string) => void;
}

const breakpoints = {
  default: 5,
  1536: 4,
  1280: 4,
  1024: 3,
  768: 3,
  640: 2,
  0: 2,
};

export default function MasonryGrid({ crumbs, onDelete }: MasonryGridProps) {
  if (crumbs.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center py-32 px-4 text-center"
      >
        <div className="w-16 h-16 mb-6 rounded-2xl bg-surface border border-border flex items-center justify-center">
          <span className="text-2xl">🍞</span>
        </div>
        <p className="text-ink font-medium mb-1">no crumbs here yet.</p>
        <p className="text-muted text-sm">hit the + to start adding pieces you love.</p>
      </motion.div>
    );
  }

  return (
    <Masonry
      breakpointCols={breakpoints}
      className="flex -ml-3 sm:-ml-4 w-auto"
      columnClassName="pl-3 sm:pl-4 bg-clip-padding"
    >
      <AnimatePresence mode="popLayout">
        {crumbs.map((crumb) => (
          <CrumbCard key={crumb.id} crumb={crumb} onDelete={onDelete} />
        ))}
      </AnimatePresence>
    </Masonry>
  );
}
