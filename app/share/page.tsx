'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Sparkles, Check, AlertCircle, ArrowRight, Layers } from 'lucide-react';
import Link from 'next/link';
import type { Crumb, Category } from '@/types/crumb';

const CATEGORY_CHOICES = [
  'clothes',
  'shoes & accessories',
  'home & living',
  'tools & tech',
  'misc',
] as const;

function extractUrlAndTitleFromShare(
  rawText?: string | null,
  rawUrl?: string | null,
  rawTitle?: string | null
): { targetUrl: string | null; cleanTitle: string | null; imageCandidates: string[] } {
  let targetUrl: string | null = null;
  let cleanTitle: string | null = rawTitle?.trim() || null;
  const imageCandidates: string[] = [];

  // Check direct URL parameter
  if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
    targetUrl = rawUrl.trim();
  }

  // Extract from free-form shared text
  if (rawText) {
    const urls = rawText.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    for (const u of urls) {
      const clean = u.replace(/[),.;!?]+$/, '').trim();
      if (/\.(jpg|jpeg|png|webp|avif)(\?.*)?$/i.test(clean)) {
        imageCandidates.push(clean);
      } else if (!targetUrl) {
        targetUrl = clean;
      }
    }

    if (!cleanTitle && targetUrl) {
      const preUrl = rawText.split(targetUrl)[0].trim();
      const cleaned = preUrl
        .replace(/^(check\s+(this\s+)?out|look\s+at\s+this|found\s+this|loved\s+this\s+product\s+on\s+[a-z0-9&.\s]+:?|i\s+found\s+this)\s*/i, '')
        .replace(/[:|–—-]+$/, '')
        .trim();
      if (cleaned.length >= 3 && cleaned.length <= 100) {
        cleanTitle = cleaned;
      }
    }
  }

  // Handle nested wrapped redirect links
  if (targetUrl) {
    try {
      const u = new URL(targetUrl);
      const nested = u.searchParams.get('url') || u.searchParams.get('redirect') || u.searchParams.get('link');
      if (nested && (nested.startsWith('http://') || nested.startsWith('https://'))) {
        targetUrl = nested;
      }
    } catch {
      // Keep targetUrl as is
    }
  }

  return { targetUrl, cleanTitle, imageCandidates };
}

function ShareHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [status, setStatus] = useState<'extracting' | 'saving' | 'success' | 'error'>('extracting');
  const [errorMessage, setErrorMessage] = useState('');
  const [savedCrumb, setSavedCrumb] = useState<Crumb | null>(null);
  const [detectedDomain, setDetectedDomain] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('misc');
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    async function handleIncomingShare() {
      const rawText = searchParams.get('text');
      const rawUrl = searchParams.get('url');
      const rawTitle = searchParams.get('title');

      const { targetUrl, cleanTitle, imageCandidates } = extractUrlAndTitleFromShare(rawText, rawUrl, rawTitle);

      if (!targetUrl) {
        setStatus('error');
        setErrorMessage('No valid product link found in the shared content.');
        return;
      }

      try {
        const domain = new URL(targetUrl).hostname.replace(/^www\./, '');
        setDetectedDomain(domain);
      } catch {
        setDetectedDomain('product');
      }

      // Check user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const fullCurrentPath = `/share?${searchParams.toString()}`;
        router.push(`/login?redirect=${encodeURIComponent(fullCurrentPath)}`);
        return;
      }

      setStatus('saving');

      try {
        const res = await fetch('/api/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_url: targetUrl,
            page_title: cleanTitle || undefined,
            image_candidates: imageCandidates,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to save product');
        }

        const crumb: Crumb = data.crumb;
        const normalizedCat = crumb.category === 'curios' ? 'misc' : crumb.category;
        setSavedCrumb({ ...crumb, category: normalizedCat as Category });
        setSelectedCategory(normalizedCat);
        setStatus('success');

        // Allow 6 seconds before redirecting, giving user time to adjust category
        redirectTimerRef.current = setTimeout(() => {
          router.push('/');
        }, 6000);
      } catch (err) {
        console.error('[share] Error auto-capturing:', err);
        setStatus('error');
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Could not auto-capture this product. Please check the link and try again.'
        );
      }
    }

    handleIncomingShare();
  }, [searchParams, supabase, router]);

  const handleCategorySelect = async (newCat: string) => {
    if (!savedCrumb || newCat === selectedCategory) return;
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);

    setSelectedCategory(newCat);
    setUpdatingCategory(true);
    setFeedback(`Moving to ${newCat}...`);

    try {
      const res = await fetch('/api/crumbs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: savedCrumb.id, category: newCat }),
      });
      const data = await res.json();
      if (res.ok && data.crumb) {
        setSavedCrumb(data.crumb);
        setFeedback(`Saved to ${newCat}!`);
      }
    } catch (err) {
      console.error('Failed to update category:', err);
      setFeedback('Failed to change category');
    } finally {
      setUpdatingCategory(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto p-5 sm:p-6 bg-surface border border-border/80 rounded-3xl shadow-modal text-center animate-in fade-in zoom-in-95 duration-200">
      {/* Brand header */}
      <div className="mb-5">
        <span className="text-xl font-sans font-semibold tracking-tight text-ink block">
          crumbs
        </span>
        <span className="text-xs text-muted">
          every piece you love.
        </span>
      </div>

      {/* Saving state */}
      {(status === 'extracting' || status === 'saving') && (
        <div className="py-8 space-y-4">
          <div className="relative w-14 h-14 mx-auto flex items-center justify-center rounded-2xl bg-canvas border border-border shadow-soft">
            <Sparkles className="w-6 h-6 text-ink animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-medium text-ink">
              saving piece {detectedDomain ? `from ${detectedDomain}` : ''}...
            </h2>
            <p className="text-xs text-muted mt-1">
              capturing product image and sorting into your board.
            </p>
          </div>
        </div>
      )}

      {/* Success state with Category Switcher */}
      {status === 'success' && savedCrumb && (
        <div className="py-4 space-y-4">
          {/* Product Thumbnail Preview */}
          <div className="w-24 h-24 mx-auto rounded-2xl overflow-hidden bg-surface-hover border border-border shadow-soft relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={savedCrumb.image_url || '/placeholder.svg'}
              alt={savedCrumb.title || 'Saved piece'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                if (savedCrumb.original_image_url && (e.currentTarget.src !== savedCrumb.original_image_url)) {
                  e.currentTarget.src = savedCrumb.original_image_url;
                } else {
                  e.currentTarget.src = '/placeholder.svg';
                }
              }}
            />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium mb-1">
              <Check className="w-3.5 h-3.5" />
              <span>added to crumbs</span>
            </div>

            <h2 className="text-sm font-semibold text-ink line-clamp-1 mt-1">
              {savedCrumb.title || 'Product'}
            </h2>
            {savedCrumb.brand && (
              <p className="text-xs text-muted font-medium">
                {savedCrumb.brand}
              </p>
            )}
          </div>

          {/* Interactive Category Selector */}
          <div className="pt-2 pb-1 border-t border-border/50">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-medium text-muted flex items-center gap-1">
                <Layers className="w-3 h-3 text-ink-light" />
                board:
              </span>
              {feedback && (
                <span className="text-[11px] font-semibold text-emerald-600 animate-in fade-in">
                  {feedback}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 justify-center">
              {CATEGORY_CHOICES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategorySelect(cat)}
                    disabled={updatingCategory}
                    className={`px-3 py-1.5 text-xs rounded-full font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-ink text-white shadow-soft font-semibold scale-105'
                        : 'bg-surface hover:bg-surface-hover border border-border text-muted hover:text-ink'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted/70 mt-2">
              tap any category above to change where this piece goes
            </p>
          </div>

          <div className="pt-1">
            <button
              onClick={() => {
                if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
                router.push('/');
              }}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 bg-ink text-white text-xs font-semibold rounded-full hover:bg-ink/90 transition-colors shadow-soft cursor-pointer"
            >
              <span>go to board</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="py-6 space-y-4">
          <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-2xl bg-rose-50 text-rose-500 border border-rose-200">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">could not save piece</h2>
            <p className="text-xs text-muted mt-1.5 leading-relaxed">
              {errorMessage}
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/"
              className="w-full py-2 bg-ink text-white text-xs font-medium rounded-full hover:bg-ink/90 transition-colors"
            >
              go to board
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SharePage() {
  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center px-4 py-8">
      <Suspense fallback={
        <div className="text-center text-xs text-muted animate-pulse">
          opening crumbs...
        </div>
      }>
        <ShareHandler />
      </Suspense>
    </div>
  );
}
