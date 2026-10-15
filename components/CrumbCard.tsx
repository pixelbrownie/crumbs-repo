'use client';

import { useState } from 'react';
import { ExternalLink, Trash2, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Crumb } from '@/types/crumb';

interface CrumbCardProps {
  crumb: Crumb;
  onDelete?: (id: string) => void;
  onUpdate?: (crumb: Crumb) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  clothes: 'bg-rose-100/90 text-rose-700 border-rose-200/50',
  'shoes & accessories': 'bg-amber-100/90 text-amber-700 border-amber-200/50',
  'body & skin': 'bg-pink-100/90 text-pink-700 border-pink-200/50',
  'home & living': 'bg-emerald-100/90 text-emerald-700 border-emerald-200/50',
  'tools & tech': 'bg-blue-100/90 text-blue-700 border-blue-200/50',
  curios: 'bg-purple-100/90 text-purple-700 border-purple-200/50',
};

export default function CrumbCard({ crumb, onDelete, onUpdate }: CrumbCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResorting, setIsResorting] = useState(false);

  const categoryColor =
    CATEGORY_COLORS[crumb.category] ?? 'bg-zinc-100/90 text-zinc-700 border-zinc-200/50';

  const isPending = crumb.status === 'pending';
  const isFailed = crumb.status === 'failed';

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

  const handleResort = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isResorting || isPending) return;
    setIsResorting(true);
    try {
      const res = await fetch('/api/crumbs/resort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crumb_id: crumb.id }),
      });
      const data = await res.json();
      if (res.ok && data.crumb) {
        onUpdate?.(data.crumb);
      }
    } catch (err) {
      console.error('Re-sort failed:', err);
    } finally {
      setIsResorting(false);
    }
  };

  const aspectRatioStyle =
    crumb.width && crumb.height && crumb.width > 0 && crumb.height > 0
      ? { aspectRatio: `${crumb.width} / ${crumb.height}` }
      : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative mb-3 sm:mb-4 inline-block w-full break-inside-avoid [break-inside:avoid] [-webkit-column-break-inside:avoid] transform-gpu"
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
        className="block group cursor-pointer w-full select-none"
        title={crumb.title ?? crumb.category}
      >
        <div
          className="relative overflow-hidden rounded-2xl bg-surface border border-border/50 shadow-soft transition-all duration-300 group-hover:shadow-card"
          style={aspectRatioStyle}
        >
          {/* Shimmer / Blur Placeholder */}
          {crumb.blur_data_url && !imgLoaded && !imgError && (
            <div
              className="absolute inset-0 bg-cover bg-center filter blur-md transform scale-105"
              style={{ backgroundImage: `url(${crumb.blur_data_url})` }}
            />
          )}

          {/* Pending analysis banner */}
          {isPending && (
            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink/80 text-paper text-[10px] tracking-wide font-medium backdrop-blur-md shadow-soft">
              <Sparkles className="w-3 h-3 animate-spin text-amber-300" />
              <span>analyzing piece...</span>
            </div>
          )}

          {/* Failed banner */}
          {isFailed && (
            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/90 text-white text-[10px] tracking-wide font-medium backdrop-blur-md shadow-soft">
              <AlertCircle className="w-3 h-3" />
              <span>enrichment retry</span>
            </div>
          )}

          {/* Image */}
          {imgError ? (
            <div className="w-full h-44 flex items-center justify-center bg-surface-hover text-muted text-xs">
              image unavailable
            </div>
          ) : (
            <div className="relative w-full overflow-hidden bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={crumb.image_url}
                alt={crumb.title ?? `${crumb.category} item`}
                loading="lazy"
                decoding="async"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                className={`w-full h-auto block object-cover rounded-2xl max-h-[75vh] transition-transform duration-300 ease-out group-hover:scale-[1.015] ${
                  isPending ? 'opacity-85 filter contrast-95' : ''
                }`}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  maxWidth: '100%',
                }}
              />
            </div>
          )}

          {/* Soft Shimmer Overlay when pending */}
          {isPending && (
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-pulse pointer-events-none" />
          )}

          {/* Hover overlay */}
          <motion.div
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink/25 backdrop-blur-[0.5px] rounded-2xl pointer-events-none"
          />

          {/* External link icon — top right */}
          <motion.div
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 4 }}
            transition={{ duration: 0.18 }}
            className="absolute top-2.5 right-2.5 p-1.5 bg-canvas/95 backdrop-blur-md rounded-xl shadow-soft border border-border/40"
          >
            <ExternalLink className="w-3.5 h-3.5 text-ink" />
          </motion.div>

          {/* Category pill & Brand tag — bottom left */}
          <motion.div
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 4 }}
            transition={{ duration: 0.18, delay: 0.03 }}
            className="absolute bottom-2.5 left-2.5 flex flex-col gap-1 items-start"
          >
            <span
              className={`text-[11px] font-medium tracking-tight px-2.5 py-1 rounded-full backdrop-blur-md border shadow-soft ${categoryColor}`}
            >
              {crumb.category}
            </span>
            {crumb.brand && (
              <span className="text-[10px] tracking-wide text-ink/90 bg-canvas/95 backdrop-blur-md px-2 py-0.5 rounded-md border border-border/40 font-medium shadow-soft">
                {crumb.brand}
              </span>
            )}
          </motion.div>
        </div>
      </a>

      {/* Action buttons (Re-sort & Delete) — bottom right */}
      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 z-10">
        <motion.button
          animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 4 }}
          transition={{ duration: 0.18, delay: 0.04 }}
          onClick={handleResort}
          disabled={isResorting || isPending}
          title="Re-analyze & re-sort"
          aria-label="Re-analyze & re-sort"
          className="p-1.5 bg-canvas/95 backdrop-blur-md rounded-xl shadow-soft border border-border/40 hover:bg-surface-hover transition-colors duration-150 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-ink ${isResorting ? 'animate-spin' : ''}`}
          />
        </motion.button>

        {onDelete && (
          <motion.button
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 4 }}
            transition={{ duration: 0.18, delay: 0.06 }}
            onClick={handleDelete}
            disabled={isDeleting}
            id={`delete-${crumb.id}`}
            title="Remove crumb"
            aria-label="Remove crumb"
            className="p-1.5 bg-canvas/95 backdrop-blur-md rounded-xl shadow-soft border border-border/40 hover:bg-rose-50 hover:border-rose-200 transition-colors duration-150"
          >
            <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'text-muted' : 'text-rose-500'}`} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
