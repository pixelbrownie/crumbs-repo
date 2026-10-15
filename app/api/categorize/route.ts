import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { AI_CATEGORIES, type Category } from '@/types/crumb';
import { createClient } from '@/lib/supabaseServer';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_DATA_URL =
  /^data:(image\/(?:jpeg|png|webp|gif|avif));base64,([A-Za-z0-9+/]+={0,2})$/;

// Modern supported Gemini models in preferred priority order
const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

async function imageUrlToInlineData(
  url: string
): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const mimeType = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0];
    if (!mimeType.startsWith('image/')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES || buffer.byteLength === 0) return null;
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

// Smart keyword heuristic in case AI service is temporarily unavailable
function heuristicCategory(text: string): Category {
  const t = text.toLowerCase();

  // Curios (beauty, perfume, skincare, collectibles, ceramics)
  if (
    /\b(serum|moisturizer|cleanser|cream|lotion|skin|skincare|perfume|fragrance|cologne|scent|eau de parfum|edp|edt|lipstick|lip tint|lip gloss|lip balm|balm|mascara|blush|foundation|concealer|makeup|cosmetics|haircare|shampoo|conditioner|body wash|sunscreen|spf|toner|retinol|peptide|hyaluronic|candle|crystal|vase|ceramic|stationery|book|art)\b/.test(
      t
    )
  ) {
    return 'curios';
  }

  // Clothes
  if (
    /\b(dress|jacket|coat|blazer|t-shirt|tee|shirt|top|pants|trousers|jeans|sweater|hoodie|cardigan|skirt|shorts|knitwear|turtleneck|suit|vest|swimsuit|bikini|trench|denim|apparel|clothing)\b/.test(
      t
    )
  ) {
    return 'clothes';
  }

  // Shoes & Accessories
  if (
    /\b(shoe|shoes|sneaker|sneakers|boots|boot|heels|flats|loafers|sandals|mules|bag|handbag|purse|tote|backpack|wallet|clutch|jewelry|necklace|ring|earring|earrings|bracelet|watch|sunglasses|shades|hat|cap|beanie|belt|scarf)\b/.test(
      t
    )
  ) {
    return 'shoes & accessories';
  }

  // Home & Living
  if (
    /\b(candle|vase|chair|stool|table|lamp|lighting|rug|pillow|cushion|blanket|throw|bedding|linen|ceramic|ceramics|pottery|plate|bowl|cup|mug|glassware|kitchen|furniture|decor|planter|diffuser)\b/.test(
      t
    )
  ) {
    return 'home & living';
  }

  // Tools & Tech
  if (
    /\b(headphone|headphones|earbuds|speaker|audio|keyboard|mouse|laptop|phone|case|charger|cable|tech|gadget|camera|display|monitor|stationery|pen|pencil|notebook)\b/.test(
      t
    )
  ) {
    return 'tools & tech';
  }

  return 'curios';
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

  const safeTitle = typeof title === 'string' ? title.trim() : '';
  const safeProductUrl = typeof productUrl === 'string' ? productUrl.trim() : '';
  const combinedText = `${safeTitle} ${safeProductUrl}`;

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

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[categorize] GEMINI_API_KEY not set — using smart heuristic fallback');
    return NextResponse.json({ category: heuristicCategory(combinedText) });
  }

  const promptText = `You are a visual personal shopping & moodboard curator.
Analyze this item (examine the image carefully if provided, along with the title and product URL) and classify it into EXACTLY ONE category:
["clothes", "shoes & accessories", "body & skin", "home & living", "tools & tech", "curios"].

STRICT CATEGORY GUIDELINES:
1. "clothes":
   - Apparel, clothing, garments: tops, shirts, t-shirts, blouses, sweaters, knitwear, jackets, blazers, coats, trench coats, vests, dresses, gowns, skirts, trousers, pants, jeans, shorts, swimwear, lingerie.

2. "shoes & accessories":
   - Footwear: sneakers, boots, loafers, heels, sandals, mules, ballet flats, slippers.
   - Bags & Leather goods: handbags, shoulder bags, tote bags, crossbodies, backpacks, clutches, wallets, cardholders.
   - Accessories: jewelry (rings, earrings, necklaces, bracelets), watches, sunglasses, eyewear, hats, caps, beanies, scarves, belts, hair accessories.

3. "body & skin":
   - Skincare: serums, face oils, moisturizers, night creams, eye creams, cleansers, toners, face masks, sunscreens/SPF, lip balms, lip treatments.
   - Beauty & Cosmetics: lipsticks, lip glosses, blushes, foundations, concealers, bronzers, mascaras, eyeshadows.
   - Fragrance: perfumes, colognes, eau de parfum, body mists, scented oils.
   - Body & Hair: body lotions, shower gels, hand creams, shampoos, conditioners, hair treatments, wellness products.

4. "home & living":
   - Furniture: chairs, armchairs, sofas, coffee tables, dining tables, stools, shelves.
   - Home Decor: candles, candleholders, vases, mirrors, rugs, throw blankets, pillows, cushions, clocks, planters.
   - Lighting: table lamps, floor lamps, pendants, sconces.
   - Kitchen & Dining: ceramics, mugs, cups, plates, bowls, glassware, cutlery, teapots, kitchen tools.

5. "tools & tech":
   - Electronics & Gadgets: headphones, earbuds, bluetooth speakers, keyboards, mice, computer monitors, phones, phone cases, chargers, cameras.
   - Desk tools & Hardware: stationery, fountain pens, planners, desk organizers, multi-tools.

6. "curios":
   - Books, art prints, paintings, posters, photography books, vinyl records, matchboxes, vintage trinkets, novelties, gifts, and unique collectibles that do not fit into any other category.

${safeTitle ? `Product Title: "${safeTitle}"` : ''}
${safeProductUrl ? `Store / URL: "${safeProductUrl}"` : ''}

Respond ONLY with valid JSON in this exact structure:
{"category": "<one of the categories above>"}`;

  const parts: (string | { text: string } | { inlineData: { mimeType: string; data: string } })[] = [
    ...(imagePart ? [imagePart] : []),
    { text: promptText },
  ];

  try {
    const genAI = new GoogleGenAI({ apiKey });

    // Try candidate models in order to tolerate transient 503 load spikes
    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await genAI.models.generateContent({
          model,
          contents: parts as unknown as string,
        });

        const rawCategory = parseCategoryJson(response.text?.trim() ?? '');
        if (rawCategory) {
          const normalized = rawCategory.toLowerCase().trim() as Category;
          if (AI_CATEGORIES.includes(normalized as (typeof AI_CATEGORIES)[number])) {
            return NextResponse.json({ category: normalized });
          }
        }
      } catch (err: unknown) {
        console.warn(`[categorize] Model ${model} failed, trying next:`, err instanceof Error ? err.message : err);
      }
    }

    // If all models failed or returned unparseable content, use smart heuristic
    const fallback = heuristicCategory(combinedText);
    return NextResponse.json({ category: fallback });
  } catch (error) {
    console.error('[categorize] Unexpected error:', error);
    return NextResponse.json({ category: heuristicCategory(combinedText) });
  }
}
