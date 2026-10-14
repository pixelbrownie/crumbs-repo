'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Crumb } from '@/types/crumb';

interface CrumbCardProps {
  crumb: Crumb;
  onDelete?: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  clothes: 'bg-rose-100/80 text-rose-700',
  'shoes & accessories': 'bg-amber-100/80 text-amber-700',
  'home & living': 'bg-emerald-100/80 text-emerald-700',
  'tools & tech': 'bg-blue-100/80 text-blue-700',
  curios: 'bg-purple-100/80 text-purple-700',
};

export default function CrumbCard({ crumb, onDelete }: CrumbCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const categoryColor =
    CATEGORY_COLORS[crumb.category] ?? 'bg-zinc-100/80 text-zinc-700';

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/crumbs?id=${crumb.id}`, { method: 'DELETE' });
      if (res.ok) onDelete?.(crumb.id);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative mb-3 sm:mb-4 break-inside-avoid"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsHovered(true)}
      onBlurCapture={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setIsHovered(false);
        }
      }}
    >
      <a
        href={crumb.product_url}
        target="_blank"
        rel="noopener noreferrer"
        id={`crumb-${crumb.id}`}
        className="block group cursor-pointer"
        title={crumb.title ?? crumb.category}
      >
        <div className="relative overflow-hidden rounded-2xl bg-surface shadow-soft">
          {/* Image */}
          {imgError ? (
            <div className="w-full h-48 flex items-center justify-center bg-surface-hover text-muted text-xs">
              image unavailable
            </div>
          ) : (
            <div className="relative w-full">
              <Image
                src={crumb.image_url}
                alt={crumb.title ?? `${crumb.category} item`}
                width={600}
                height={900}
                className="w-full h-auto object-cover rounded-2xl"
                onError={() => setImgError(true)}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                unoptimized={crumb.image_url.startsWith('http')}
              />
            </div>
          )}

          {/* Hover overlay */}
          <motion.div
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink/30 rounded-2xl pointer-events-none"
          />

          {/* External link icon — top right */}
          <motion.div
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 4 }}
            transition={{ duration: 0.18 }}
            className="absolute top-3 right-3 p-1.5 bg-canvas/90 backdrop-blur-sm rounded-lg shadow-soft"
          >
            <ExternalLink className="w-3.5 h-3.5 text-ink" />
          </motion.div>

          {/* Category pill — bottom left */}
          <motion.div
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 4 }}
            transition={{ duration: 0.18, delay: 0.04 }}
            className="absolute bottom-3 left-3"
          >
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm ${categoryColor}`}
            >
              {crumb.category}
            </span>
          </motion.div>

        </div>
      </a>
      {onDelete && (
        <motion.button
          animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 4 }}
          transition={{ duration: 0.18, delay: 0.06 }}
          onClick={handleDelete}
          disabled={isDeleting}
          id={`delete-${crumb.id}`}
          title="Remove crumb"
          aria-label="Remove crumb"
          className="absolute bottom-3 right-3 p-1.5 bg-canvas/90 backdrop-blur-sm rounded-lg shadow-soft hover:bg-rose-50 transition-colors duration-150"
        >
          <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'text-muted' : 'text-rose-500'}`} />
        </motion.button>
      )}
    </motion.div>
  );
}
