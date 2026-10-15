import { GoogleGenAI } from '@google/genai';
import { type AnalyzeProductInput, type ProductAnalysis, ProductAnalysisSchema } from './types';

const CANDIDATE_GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
].filter(Boolean) as string[];

export async function analyzeWithGemini(
  input: AnalyzeProductInput
): Promise<ProductAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenAI({ apiKey });

  const customList = (input.customCategories || [])
    .map((c) => c.trim().toLowerCase())
    .filter(
      (c) =>
        c &&
        !['all', 'clothes', 'shoes & accessories', 'home & living', 'tools & tech', 'misc'].includes(
          c
        )
    );

  const customRules =
    customList.length > 0
      ? `\n- USER'S CUSTOM BOARDS (STRONGLY PRIORITIZE if the piece fits any of these!):\n` +
        customList.map((c) => `  * "${c}"`).join('\n')
      : '';

  const allowedCategoriesList = [
    'clothes',
    'shoes & accessories',
    'home & living',
    'tools & tech',
    'misc',
    ...customList,
  ];

  const prompt = `You are a discerning visual moodboard curator and product taxonomist.
Examine the product image FIRST with high visual scrutiny.
Use the product title, URL, and page metadata only as secondary hints.

CLASSIFICATION RULES:
- category: Pick EXACTLY one from the standard boards OR the user's custom boards:
  * "clothes": apparel, jackets, coats, tops, shirts, trousers, dresses, knitwear, skirts, swimwear, underwear.
  * "shoes & accessories": ALL footwear of any kind (shoes, sneakers, running shoes, trainers, boots, heels, flats, loafers, sandals, mules, slides), bags, handbags, totes, backpacks, wallets, jewelry, watches, sunglasses, hats, belts, scarves.
  * "home & living": furniture, decor, lighting/lamps, candles, tableware, ceramics, glassware, bedding, cushions, rugs, kitchenware.
  * "tools & tech": electronics, audio/headphones, computer hardware, keyboards, cameras, phone cases, gadgets, desk tools.
  * "misc": miscellaneous items, art prints, books, collectibles, novelties, gifts, unique artifacts.${customRules}
If the item matches one of the user's custom boards, PREFER THAT CUSTOM BOARD.

- brand: Extract ONLY if visually branded or explicitly specified in metadata/title; otherwise set to null.
- colors: 1 to 3 dominant, plain lowercase color names (e.g. ["sand", "charcoal"], ["olive"]).
- materials: Materials visible or stated (e.g. ["wool", "linen", "terracotta", "leather", "aluminum"]).
- aesthetic: 1 to 3 distinct aesthetic vibes (e.g. ["minimalist", "brutalist", "vintage", "y2k", "cottagecore", "scandinavian"]).
- tags: 5 to 10 lowercase, hyphen-free search tags describing silhouette, finish, use, and mood.
- confidence: Number between 0.0 and 1.0 reflecting your certainty.

Product Title: "${input.title || 'Untitled item'}"
Product URL: "${input.productUrl || ''}"
${input.pageMeta?.brand ? `Brand hint: "${input.pageMeta.brand}"` : ''}
${input.pageMeta?.price ? `Price hint: "${input.pageMeta.price}"` : ''}

Respond with valid JSON conforming to this schema:
{
  "item_type": "string",
  "category": ${allowedCategoriesList.map((c) => `"${c}"`).join(' | ')},
  "brand": "string" | null,
  "colors": ["string"],
  "materials": ["string"],
  "aesthetic": ["string"],
  "tags": ["string"],
  "confidence": number
}`;

  const contents: unknown[] = [];
  if (input.imageBytes && input.imageBytes.length > 0) {
    const base64 = Buffer.isBuffer(input.imageBytes)
      ? input.imageBytes.toString('base64')
      : Buffer.from(input.imageBytes).toString('base64');
    const mimeType = input.mimeType || 'image/jpeg';
    contents.push({
      inlineData: {
        mimeType,
        data: base64,
      },
    });
  }
  contents.push(prompt);

  let lastError: Error | null = null;

  for (const model of CANDIDATE_GEMINI_MODELS) {
    try {
      const response = await genAI.models.generateContent({
        model,
        contents: contents as unknown as string,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text?.trim() || '';
      const parsed = JSON.parse(text);
      if (typeof parsed.category === 'string') {
        parsed.category = parsed.category.toLowerCase().trim();
      }
      const validated = ProductAnalysisSchema.parse(parsed);
      return validated;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // try next candidate model
    }
  }

  throw lastError || new Error('Gemini failed to analyze product');
}
