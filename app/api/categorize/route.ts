import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { analyzeProduct } from '@/lib/ai';
import { downloadImageWithReferer } from '@/lib/imageProcessor';
import { AI_CATEGORIES, type Category } from '@/types/crumb';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_DATA_URL =
  /^data:(image\/(?:jpeg|png|webp|gif|avif));base64,([A-Za-z0-9+/]+={0,2})$/;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

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

  const { imageUrl, imageBase64, title, productUrl } = body as {
    imageUrl?: unknown;
    imageBase64?: unknown;
    title?: unknown;
    productUrl?: unknown;
  };

  const safeTitle = typeof title === 'string' ? title.trim() : undefined;
  const safeProductUrl = typeof productUrl === 'string' ? productUrl.trim() : undefined;

  let imageBytes: Buffer | undefined;
  let mimeType: string = 'image/jpeg';

  // 1. Process base64 image if present
  if (typeof imageBase64 === 'string' && imageBase64) {
    const match = IMAGE_DATA_URL.exec(imageBase64);
    if (match) {
      mimeType = match[1];
      imageBytes = Buffer.from(match[2], 'base64');
    } else {
      const base64Data = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;
      mimeType = imageBase64.startsWith('data:')
        ? (imageBase64.match(/^data:(image\/[^;]+);/)?.[1] ?? 'image/jpeg')
        : 'image/jpeg';
      imageBytes = Buffer.from(base64Data, 'base64');
    }
  }

  // 2. Fetch image from URL if no base64
  if (!imageBytes && typeof imageUrl === 'string' && imageUrl) {
    const downloaded = await downloadImageWithReferer(imageUrl, safeProductUrl);
    if (downloaded) {
      imageBytes = downloaded.buffer;
      mimeType = downloaded.mimeType;
    }
  }

  try {
    // 3. Fetch user's custom boards to prioritize
    let customCategories: string[] = [];
    try {
      const { data: userCols } = await supabase
        .from('collections')
        .select('name')
        .eq('user_id', user.id);
      if (userCols && userCols.length > 0) {
        customCategories = userCols
          .map((c: { name: string }) => c.name?.toLowerCase().trim())
          .filter(Boolean);
      }
    } catch (colErr) {
      console.warn('[categorize] Error querying custom collections:', colErr);
    }

    // 4. Run full provider-agnostic AI Vision Pipeline
    const analysis = await analyzeProduct({
      imageBytes,
      mimeType,
      title: safeTitle,
      productUrl: safeProductUrl,
      customCategories,
    });

    const isCustom = customCategories.includes(analysis.category.toLowerCase().trim());
    const category = isCustom
      ? analysis.category
      : AI_CATEGORIES.includes(analysis.category as any)
      ? (analysis.category as Category)
      : 'misc';

    return NextResponse.json({
      category,
      item_type: analysis.item_type,
      brand: analysis.brand,
      colors: analysis.colors,
      materials: analysis.materials,
      aesthetic: analysis.aesthetic,
      tags: analysis.tags,
      confidence: analysis.confidence,
    });
  } catch (error) {
    console.error('[categorize] AI analysis failed:', error);
    return NextResponse.json(
      { error: 'Could not categorize this item.' },
      { status: 500 }
    );
  }
}
