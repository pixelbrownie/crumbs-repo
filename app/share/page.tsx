'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Sparkles, Check, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { Crumb } from '@/types/crumb';

function extractUrlAndTitleFromShare(
  rawText?: string | null,
  rawUrl?: string | null,
  rawTitle?: string | null
): { targetUrl: string | null; cleanTitle: string | null } {
  let targetUrl: string | null = null;
  let cleanTitle: string | null = rawTitle?.trim() || null;

  // 1. Check direct URL parameter
  if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
    targetUrl = rawUrl.trim();
  }

  // 2. Extract from free-form shared text
  if (!targetUrl && rawText) {
    const urls = rawText.match(/https?:\/\/[^\s"'<>]+/gi);
    if (urls && urls.length > 0) {
      targetUrl = urls[0].replace(/[),.;!?]+$/, '').trim();

      // If no explicit title, extract clean product hint from the preceding text
      if (!cleanTitle) {
        const preUrl = rawText.split(urls[0])[0].trim();
        const cleaned = preUrl
          .replace(/^(check\s+(this\s+)?out|look\s+at\s+this|found\s+this|loved\s+this\s+product\s+on\s+[a-z0-9&.\s]+:?|i\s+found\s+this)\s*/i, '')
          .replace(/[:|–—-]+$/, '')
          .trim();
        if (cleaned.length >= 3 && cleaned.length <= 100) {
          cleanTitle = cleaned;
        }
      }
    }
  }

  // 3. Handle nested wrapped redirect links (e.g. ?url=https%3A%2F%2F...)
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

  return { targetUrl, cleanTitle };
}

function ShareHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [status, setStatus] = useState<'extracting' | 'saving' | 'success' | 'error'>('extracting');
  const [errorMessage, setErrorMessage] = useState('');
  const [savedCrumb, setSavedCrumb] = useState<Crumb | null>(null);
  const [detectedDomain, setDetectedDomain] = useState('');
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    async function handleIncomingShare() {
      const rawText = searchParams.get('text');
      const rawUrl = searchParams.get('url');
      const rawTitle = searchParams.get('title');

      const { targetUrl, cleanTitle } = extractUrlAndTitleFromShare(rawText, rawUrl, rawTitle);

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
        // Redirect to login, preserving destination
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
            image_candidates: [],
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to save product');
        }

        setSavedCrumb(data.crumb);
        setStatus('success');

        // Automatically route to the home board after 1.8 seconds
        setTimeout(() => {
          router.push('/');
        }, 1800);
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

  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-surface border border-border/80 rounded-3xl shadow-modal text-center animate-in fade-in zoom-in-95 duration-200">
      {/* Brand header */}
      <div className="mb-6">
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
              AI vision is analyzing the item and sorting it into your board.
            </p>
          </div>
        </div>
      )}

      {/* Success state */}
      {status === 'success' && (
        <div className="py-6 space-y-4">
          <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <Check className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">
              saved to {savedCrumb?.category || 'your board'}!
            </h2>
            {savedCrumb?.brand && (
              <p className="text-xs text-muted mt-0.5 font-medium">
                {savedCrumb.brand}
              </p>
            )}
            <p className="text-[11px] text-muted/80 mt-2">
              taking you to your board...
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-paper text-xs font-medium rounded-full hover:bg-ink/90 transition-colors mt-2"
          >
            <span>view board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
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
              className="w-full py-2 bg-ink text-paper text-xs font-medium rounded-full hover:bg-ink/90 transition-colors"
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
