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

  const prompt = `You are a discerning visual moodboard curator and product taxonomist.
Examine the product image FIRST with high visual scrutiny.
Use the product title, URL, and page metadata only as secondary hints.

CLASSIFICATION RULES:
- category: Pick EXACTLY one from:
  * "clothes": apparel, jackets, coats, tops, shirts, trousers, dresses, knitwear, skirts, swimwear, underwear.
  * "shoes & accessories": footwear (sneakers, boots, heels, flats, loafers), bags (handbags, totes, backpacks), jewelry, watches, sunglasses, hats, belts, scarves.
  * "home & living": furniture, decor, lighting/lamps, candles, tableware, ceramics, glassware, bedding, cushions, rugs, kitchenware.
  * "tools & tech": electronics, audio/headphones, computer hardware, keyboards, cameras, phone cases, gadgets, desk tools, stationery.
  * "curios": art prints, framed photography, books, monographs, vinyl records, matchboxes, collectibles, novelties, gifts, unique artifacts.
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
  "category": "clothes" | "shoes & accessories" | "home & living" | "tools & tech" | "curios",
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
      const validated = ProductAnalysisSchema.parse(parsed);
      return validated;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // try next candidate model
    }
  }

  throw lastError || new Error('Gemini failed to analyze product');
}
