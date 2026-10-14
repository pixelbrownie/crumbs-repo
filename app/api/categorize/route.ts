import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { AI_CATEGORIES } from '@/types/crumb';
import { createClient } from '@/lib/supabaseServer';

const FALLBACK_CATEGORY = 'curios';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_DATA_URL =
  /^data:(image\/(?:jpeg|png|webp|gif|avif));base64,([A-Za-z0-9+/]+={0,2})$/;

async function imageUrlToInlineData(
  url: string
): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'crumbs/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const mimeType = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0];
    if (!mimeType.startsWith('image/')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null;
    return { mimeType, data: buffer.toString('base64') };
  } catch {
    return null;
  }
}

function parseCategoryJson(text: string): string | null {
  const trimmed = text.trim();
  try {
    const direct = JSON.parse(trimmed) as { category?: string };
    if (typeof direct.category === 'string') return direct.category;
  } catch {
    // fall through
  }
  const jsonMatch = trimmed.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { category?: string };
    return typeof parsed.category === 'string' ? parsed.category : null;
  } catch {
    return null;
  }
}

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

  if (
    (imageUrl !== undefined && typeof imageUrl !== 'string') ||
    (imageBase64 !== undefined && typeof imageBase64 !== 'string') ||
    (title !== undefined && typeof title !== 'string') ||
    (productUrl !== undefined && typeof productUrl !== 'string')
  ) {
    return NextResponse.json({ error: 'Invalid categorization input' }, { status: 400 });
  }

  let imagePart: { inlineData: { mimeType: string; data: string } } | undefined;

  if (typeof imageBase64 === 'string' && imageBase64) {
    const match = IMAGE_DATA_URL.exec(imageBase64);
    if (match) {
      const imageSize = Math.floor((match[2].length * 3) / 4);
      if (imageSize <= MAX_IMAGE_BYTES) {
        imagePart = { inlineData: { mimeType: match[1], data: match[2] } };
      }
    } else {
      const base64Data = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;
      const mimeType = imageBase64.startsWith('data:')
        ? (imageBase64.match(/^data:(image\/[^;]+);/)?.[1] ?? 'image/jpeg')
        : 'image/jpeg';
      imagePart = { inlineData: { mimeType, data: base64Data } };
    }
  } else if (typeof imageUrl === 'string' && imageUrl) {
    const inline = await imageUrlToInlineData(imageUrl);
    if (inline) imagePart = { inlineData: inline };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[categorize] GEMINI_API_KEY not set — using fallback category');
    return NextResponse.json({ category: FALLBACK_CATEGORY });
  }

  const categories = AI_CATEGORIES.join('", "');
  const parts = [
    ...(imagePart ? [imagePart] : []),
    {
      text: [
        title ? `Product title: ${title.slice(0, 200)}` : '',
        productUrl ? `Product link: ${productUrl.slice(0, 2000)}` : '',
        `Analyze this item and classify it into exactly one of these categories: ["${categories}"].`,
        'Respond ONLY with strict JSON: {"category": "..."}.',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts }],
    });

    const rawCategory = parseCategoryJson(response.text?.trim() ?? '');
    if (!rawCategory) {
      console.warn('[categorize] Could not parse Gemini response');
      return NextResponse.json({ category: FALLBACK_CATEGORY });
    }

    const category = rawCategory.toLowerCase().trim();
    const valid = AI_CATEGORIES.includes(category as (typeof AI_CATEGORIES)[number]);
    return NextResponse.json({ category: valid ? category : FALLBACK_CATEGORY });
  } catch (error) {
    console.error('[categorize] Error:', error);
    return NextResponse.json({ category: FALLBACK_CATEGORY });
  }
}
