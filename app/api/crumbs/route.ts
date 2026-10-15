import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { getCrumbImageUrl } from '@/lib/crumbImages';
import { AI_CATEGORIES } from '@/types/crumb';
import { detectCategoryFromText } from '@/lib/ai';

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isUserImagePath(value: unknown, userId: string): value is string {
  return (
    typeof value === 'string' &&
    new RegExp(`^${userId}/\\d+-[a-z0-9]+\\.(jpg|png|webp|gif|avif)$`, 'i').test(value)
  );
}

// GET /api/crumbs — fetch authenticated user's crumbs
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const collectionId = searchParams.get('collection_id');
  const searchQuery = searchParams.get('q')?.trim();
  const tag = searchParams.get('tag')?.trim();

  // Auto-heal any crumbs stuck in 'curios' — distribute to clothes, shoes, home, tech or misc
  try {
    const { data: curiosCrumbs } = await supabase
      .from('crumbs')
      .select('id, title, product_url, item_type')
      .eq('user_id', user.id)
      .eq('category', 'curios')
      .limit(50);

    for (const c of curiosCrumbs || []) {
      const combined = `${c.title || ''} ${c.product_url || ''} ${c.item_type || ''}`;
      const detected = detectCategoryFromText(combined);
      await supabase
        .from('crumbs')
        .update({ category: detected || 'misc' })
        .eq('id', c.id);
    }
  } catch (healErr) {
    console.warn('[crumbs] Auto-heal curios error:', healErr);
  }

  let query = supabase
    .from('crumbs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (collectionId) {
    // Filter through crumb_collections join
    const { data: colCrumbs } = await supabase
      .from('crumb_collections')
      .select('crumb_id')
      .eq('collection_id', collectionId);

    const ids = (colCrumbs || []).map((r: any) => r.crumb_id);
    query = query.in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
  }

  if (category && category !== 'all') {
    if (category === 'misc' || category === 'curios') {
      query = query.or('category.eq.misc,category.eq.curios');
    } else {
      query = query.eq('category', category);
    }
  }

  if (tag) {
    query = query.contains('tags', [tag.toLowerCase()]);
  }

  if (searchQuery) {
    query = query.or(
      `title.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%,item_type.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`
    );
  }

  // Auto-heal any stale pending crumbs (>15 seconds old) to avoid endless spinner
  try {
    const staleThreshold = new Date(Date.now() - 15000).toISOString();
    await supabase
      .from('crumbs')
      .update({ status: 'ready' })
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lt('created_at', staleThreshold);
  } catch {
    // Non-blocking
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const crumbs = await Promise.all(
      data.map(async (crumb) => {
        let rawUrl = crumb.image_url;
        if (!rawUrl || rawUrl.includes('crumbsbypixel.vercel.app/placeholder.svg')) {
          rawUrl = crumb.original_image_url || '/placeholder.svg';
        }
        let resolvedUrl = rawUrl;
        try {
          resolvedUrl = await getCrumbImageUrl(supabase, rawUrl);
        } catch {
          resolvedUrl = crumb.original_image_url || rawUrl;
        }
        return {
          ...crumb,
          image_url: resolvedUrl,
        };
      })
    );
    return NextResponse.json({ crumbs });
  } catch (error) {
    console.error('[crumbs] Unable to prepare board images:', error);
    return NextResponse.json({ error: 'Unable to load board images' }, { status: 500 });
  }
}

// POST /api/crumbs — insert a new crumb
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
  }
  const { image_url, product_url, category, title } = body as {
    image_url?: unknown;
    product_url?: unknown;
    category?: unknown;
    title?: unknown;
  };

  if (
    !(
      isHttpUrl(image_url) ||
      isUserImagePath(image_url, user.id)
    ) ||
    !isHttpUrl(product_url) ||
    typeof category !== 'string' ||
    !category.trim() ||
    category.trim().length > 60 ||
    (title !== undefined && title !== null && typeof title !== 'string')
  ) {
    return NextResponse.json(
      { error: 'Valid image_url, product_url, and category are required' },
      { status: 400 }
    );
  }

  let responseImageUrl: string;
  try {
    responseImageUrl = await getCrumbImageUrl(supabase, image_url);
  } catch (error) {
    console.error('[crumbs] Unable to prepare new image:', error);
    return NextResponse.json({ error: 'Unable to prepare the uploaded image' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('crumbs')
    .insert({
      user_id: user.id,
      image_url,
      product_url,
      category,
      title: typeof title === 'string' ? title.slice(0, 100) || null : null,
      status: 'ready',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { crumb: { ...data, image_url: responseImageUrl } },
    { status: 201 }
  );
}

// DELETE /api/crumbs?id=... — delete a crumb
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('crumbs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/crumbs — update category of a crumb
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id, category } = body;
  if (!id || !category) {
    return NextResponse.json({ error: 'id and category are required' }, { status: 400 });
  }

  const cleanCategory = category === 'curios' ? 'misc' : category;

  const { data, error } = await supabase
    .from('crumbs')
    .update({ category: cleanCategory })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ crumb: data });
}
