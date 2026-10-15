import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { createClient as createServerSupabase } from '@/lib/supabaseServer';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { hashCaptureToken, getCorsHeaders } from '@/lib/security';
import { scrapeProductPage } from '@/lib/scraper';
import { enrichCrumb } from '@/lib/enrichment';

const CaptureInputSchema = z.object({
  product_url: z.string().url(),
  page_title: z.string().nullable().optional(),
  image_candidates: z.array(z.string()).optional(),
  selected_image_url: z.string().nullable().optional(),
  page_meta: z.record(z.string(), z.unknown()).optional(),
});

// Simple in-memory rate limiter per user (30 requests/minute)
const userRequestCounts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userRequestCounts.get(userId);
  if (!entry || now > entry.resetAt) {
    userRequestCounts.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) {
    return false;
  }
  entry.count++;
  return true;
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // 1. Authenticate via Bearer Token OR Supabase Session Cookie
  let userId: string | null = null;
  const authHeader = req.headers.get('authorization');
  let supabase = await createServerSupabase();

  if (authHeader?.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7).trim();
    const tokenHash = hashCaptureToken(rawToken);

    // Look up capture token
    const { data: tokenRecord } = await supabase
      .from('capture_tokens')
      .select('id, user_id, revoked_at')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .maybeSingle();

    if (tokenRecord?.user_id) {
      userId = tokenRecord.user_id;

      // Update last_used_at
      void supabase
        .from('capture_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', tokenRecord.id);
    }
  }

  // Fallback to cookie session
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      userId = user.id;
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid capture token or session required' },
      { status: 401, headers: corsHeaders }
    );
  }

  // 2. Rate limiting
  if (!checkRateLimit(userId)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429, headers: corsHeaders }
    );
  }

  // 3. Parse & validate payload
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  const parsed = CaptureInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid capture payload', details: parsed.error.format() },
      { status: 400, headers: corsHeaders }
    );
  }

  const { product_url, page_title, selected_image_url, image_candidates = [], page_meta } = parsed.data;

  // 4. Deduplicate: if this user already captured this product_url, return existing crumb
  const { data: existingCrumb } = await supabase
    .from('crumbs')
    .select('*')
    .eq('user_id', userId)
    .eq('product_url', product_url)
    .maybeSingle();

  if (existingCrumb) {
    return NextResponse.json(
      { crumb: existingCrumb, deduplicated: true },
      { status: 200, headers: corsHeaders }
    );
  }

  // 5. Gather candidates & scrape if needed
  let candidates = [...image_candidates];
  if (selected_image_url) {
    candidates = [selected_image_url, ...candidates];
  }

  let finalTitle = page_title;
  let sourceDomain = '';
  try {
    sourceDomain = new URL(product_url).hostname.replace(/^www\./, '');
  } catch {
    sourceDomain = 'unknown';
  }

  // If no image candidates were supplied, scrape the page server-side
  if (candidates.length === 0) {
    const scraped = await scrapeProductPage(product_url);
    candidates = scraped.imageCandidates;
    if (!finalTitle && scraped.title) finalTitle = scraped.title;
    if (scraped.sourceDomain) sourceDomain = scraped.sourceDomain;
  }

  // Immediate placeholder URL until rehosted
  const initialImageUrl = candidates[0] || '/placeholder.svg';

  // 6. Insert row immediately with status 'pending'
  const { data: newCrumb, error: insertError } = await supabase
    .from('crumbs')
    .insert({
      user_id: userId,
      image_url: initialImageUrl,
      original_image_url: candidates[0] || null,
      product_url,
      category: 'curios',
      title: finalTitle || null,
      source_domain: sourceDomain,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError || !newCrumb) {
    console.error('[capture] Error inserting crumb:', insertError);
    return NextResponse.json(
      { error: insertError?.message || 'Failed to save crumb' },
      { status: 500, headers: corsHeaders }
    );
  }

  // 7. Perform enrichment reliably within the execution window so Vercel doesn't kill it
  try {
    await Promise.race([
      enrichCrumb(supabase, {
        crumbId: newCrumb.id,
        userId,
        productUrl: product_url,
        sourceDomain,
        imageCandidates: candidates,
        title: finalTitle,
        pageMeta: page_meta,
      }),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  } catch (enrichErr) {
    console.warn('[capture] Synchronous enrichment window passed:', enrichErr);
  }

  // Ensure Vercel serverless keeps context alive if trailing operations remain
  after(async () => {
    try {
      const { data: check } = await supabase
        .from('crumbs')
        .select('status')
        .eq('id', newCrumb.id)
        .single();

      if (check?.status === 'pending') {
        await enrichCrumb(supabase, {
          crumbId: newCrumb.id,
          userId,
          productUrl: product_url,
          sourceDomain,
          imageCandidates: candidates,
          title: finalTitle,
          pageMeta: page_meta,
        });
      }
    } catch (err) {
      console.warn('[capture] Background after() error:', err);
    }
  });

  // Query updated crumb so user gets 'ready' immediately
  const { data: finalCrumb } = await supabase
    .from('crumbs')
    .select('*')
    .eq('id', newCrumb.id)
    .single();

  return NextResponse.json(
    { crumb: finalCrumb || newCrumb, deduplicated: false },
    { status: 201, headers: corsHeaders }
  );
}
