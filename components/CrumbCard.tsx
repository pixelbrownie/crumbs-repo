'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Trash2, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Crumb } from '@/types/crumb';

interface CrumbCardProps {
  crumb: Crumb;
  onDelete?: (id: string) => void;
  onUpdate?: (crumb: Crumb) => void;
  readOnly?: boolean;
  customCategories?: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  clothes: 'bg-rose-100/90 text-rose-700 border-rose-200/50',
  'shoes & accessories': 'bg-amber-100/90 text-amber-700 border-amber-200/50',
  'body & skin': 'bg-pink-100/90 text-pink-700 border-pink-200/50',
  'home & living': 'bg-emerald-100/90 text-emerald-700 border-emerald-200/50',
  'tools & tech': 'bg-blue-100/90 text-blue-700 border-blue-200/50',
  misc: 'bg-purple-100/90 text-purple-700 border-purple-200/50',
  curios: 'bg-purple-100/90 text-purple-700 border-purple-200/50',
};

export default function CrumbCard({
  crumb,
  onDelete,
  onUpdate,
  readOnly = false,
  customCategories = [],
}: CrumbCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(crumb.image_url);
  const [attempt, setAttempt] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResorting, setIsResorting] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);

  const displayCategory = crumb.category === 'curios' ? 'misc' : crumb.category;
  const categoryColor =
    CATEGORY_COLORS[displayCategory] ?? 'bg-zinc-100/90 text-zinc-700 border-zinc-200/50';

  useEffect(() => {
    setCurrentSrc(crumb.image_url);
    setImgError(false);
    setAttempt(0);
  }, [crumb.image_url]);

  const handleCategorySelect = async (e: React.MouseEvent, newCat: string) => {
    e.preventDefault();
    e.stopPropagation();
    setShowCategoryPicker(false);
    if (newCat === crumb.category || isUpdatingCategory) return;

    setIsUpdatingCategory(true);
    try {
      const res = await fetch('/api/crumbs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: crumb.id, category: newCat }),
      });
      const data = await res.json();
      if (res.ok && data.crumb) {
        onUpdate?.(data.crumb);
      }
    } catch (err) {
      console.error('Failed to change category:', err);
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  const handleImageError = () => {
    // Attempt 1: Try original_image_url if storage signed URL failed
    if (attempt === 0 && crumb.original_image_url && crumb.original_image_url !== currentSrc) {
      setAttempt(1);
      setCurrentSrc(crumb.original_image_url);
      return;
    }
    // Attempt 2: Route through proxy to bypass CDN anti-hotlinking
    const sourceToProxy = crumb.original_image_url || (currentSrc.startsWith('http') ? currentSrc : null);
    if (attempt <= 1 && sourceToProxy && !currentSrc.includes('/api/proxy-image')) {
      setAttempt(2);
      setCurrentSrc(`/api/proxy-image?url=${encodeURIComponent(sourceToProxy)}`);
      return;
    }
    // Attempt 3: Clean local placeholder SVG
    if (attempt <= 2 && currentSrc !== '/placeholder.svg') {
      setAttempt(3);
      setCurrentSrc('/placeholder.svg');
      return;
    }
    setImgError(true);
  };

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
            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink/80 text-white text-[10px] tracking-wide font-medium backdrop-blur-md shadow-soft">
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
            <div className="w-full h-44 flex flex-col items-center justify-center bg-surface-hover text-muted text-xs p-4 text-center">
              <span className="font-medium text-ink/70 capitalize mb-1">{crumb.category}</span>
              <span className="text-[11px] text-muted">image preview unavailable</span>
            </div>
          ) : (
            <div className="relative w-full overflow-hidden bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentSrc}
                alt={crumb.title ?? `${crumb.category} item`}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onLoad={() => setImgLoaded(true)}
                onError={handleImageError}
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
            animate={{ opacity: isHovered || showCategoryPicker ? 1 : 0, y: isHovered || showCategoryPicker ? 0 : 4 }}
            transition={{ duration: 0.18, delay: 0.03 }}
            className="absolute bottom-2.5 left-2.5 flex flex-col gap-1 items-start z-30"
          >
            {readOnly || !onUpdate ? (
              <span className={`text-[11px] font-medium tracking-tight px-2.5 py-1 rounded-full backdrop-blur-md border shadow-soft ${categoryColor}`}>
                {displayCategory}
              </span>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowCategoryPicker((prev) => !prev);
                  }}
                  disabled={isUpdatingCategory}
                  title="Change category"
                  className={`text-[11px] font-medium tracking-tight px-2.5 py-1 rounded-full backdrop-blur-md border shadow-soft transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 ${categoryColor}`}
                >
                  <span>{displayCategory}</span>
                  <span className="text-[9px] opacity-60">▾</span>
                </button>

                {/* Category Picker Popover */}
                {showCategoryPicker && (
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="absolute bottom-full left-0 mb-1.5 w-44 p-1.5 bg-surface border border-border rounded-2xl shadow-card flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <span className="text-[10px] uppercase tracking-wider text-muted font-semibold px-2 py-1">
                      move to board
                    </span>
                    {(['clothes', 'shoes & accessories', 'home & living', 'tools & tech', 'misc'] as const).map(
                      (cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={(e) => handleCategorySelect(e, cat)}
                          className={`text-left px-2 py-1.5 text-xs rounded-xl font-medium transition-colors cursor-pointer ${
                            displayCategory === cat
                              ? 'bg-ink text-white font-semibold'
                              : 'text-ink hover:bg-surface-hover'
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    )}

                    {/* Custom user boards */}
                    {customCategories.filter(
                      (c) =>
                        c &&
                        ![
                          'clothes',
                          'shoes & accessories',
                          'home & living',
                          'tools & tech',
                          'misc',
                          'curios',
                          'all',
                        ].includes(c.toLowerCase().trim())
                    ).length > 0 && (
                      <>
                        <div className="w-full h-px bg-border my-1" />
                        <span className="text-[9px] uppercase tracking-wider text-muted font-semibold px-2 py-0.5">
                          your boards
                        </span>
                        {customCategories
                          .filter(
                            (c) =>
                              c &&
                              ![
                                'clothes',
                                'shoes & accessories',
                                'home & living',
                                'tools & tech',
                                'misc',
                                'curios',
                                'all',
                              ].includes(c.toLowerCase().trim())
                          )
                          .map((customCat) => (
                            <button
                              key={customCat}
                              type="button"
                              onClick={(e) => handleCategorySelect(e, customCat)}
                              className={`text-left px-2 py-1.5 text-xs rounded-xl font-medium transition-colors cursor-pointer ${
                                displayCategory.toLowerCase() === customCat.toLowerCase()
                                  ? 'bg-ink text-white font-semibold'
                                  : 'text-ink hover:bg-surface-hover'
                              }`}
                            >
                              {customCat}
                            </button>
                          ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {crumb.brand && (
              <span className="text-[10px] tracking-wide text-ink/90 bg-canvas/95 backdrop-blur-md px-2 py-0.5 rounded-md border border-border/40 font-medium shadow-soft">
                {crumb.brand}
              </span>
            )}
          </motion.div>
        </div>
      </a>

      {/* Action buttons (Re-sort & Delete) — bottom right */}
      {!readOnly && (
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 z-10">
          {onUpdate && (
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
          )}

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
      )}
    </motion.div>
  );
}
