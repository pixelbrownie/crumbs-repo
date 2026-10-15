import { type AnalyzeProductInput, type ProductAnalysis, ProductAnalysisSchema } from './types';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const DEFAULT_GROK_MODEL = 'grok-2-vision-1212';

export async function analyzeWithGrok(input: AnalyzeProductInput): Promise<ProductAnalysis> {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY is not set');
  }

  const model = process.env.GROK_MODEL || DEFAULT_GROK_MODEL;

  const promptText = `You are a museum curator and visual archivist for "crumbs", a visual moodboard app.
Inspect the product image carefully first. Use the title and URL only as secondary hints.

CRITICAL INSTRUCTIONS:
1. Classify the item into EXACTLY ONE of these 5 categories:
   - "clothes" (apparel, dresses, jackets, trousers, knitwear)
   - "shoes & accessories" (footwear, bags, purses, belts, jewelry, eyewear)
   - "home & living" (furniture, lighting, kitchenware, bedding, decor, rugs)
   - "tools & tech" (electronics, audio, computing, gadgets, hardware)
   - "curios" (fragrances, skincare, cosmetics, candles, ceramics, art, objects)

2. Output a strictly valid JSON object matching this schema:
{
  "item_type": "specific name of item, e.g. trench coat, loafer, table lamp",
  "category": "one of the 5 allowed categories above",
  "brand": "brand name if visible or stated, otherwise null",
  "colors": ["1-3 plain color names, e.g. black, olive green, cream"],
  "materials": ["observable materials, e.g. leather, wool, brass"],
  "aesthetic": ["1-3 vibes, e.g. minimalist, vintage, y2k, cottagecore, industrial"],
  "tags": ["5-10 lowercase descriptive tags"],
  "confidence": 0.95
}`;

  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: string } }
  > = [{ type: 'text', text: promptText }];

  if (input.imageBytes) {
    const mime = input.mimeType || 'image/jpeg';
    const base64Data = input.imageBytes.toString('base64');
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${mime};base64,${base64Data}`,
        detail: 'high',
      },
    });
  }

  if (input.title) {
    userContent.push({ type: 'text', text: `Context Title: ${input.title}` });
  }
  if (input.productUrl) {
    userContent.push({ type: 'text', text: `Product URL: ${input.productUrl}` });
  }

  const payload = {
    model,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`xAI API error (${res.status}): ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Grok vision API');
    }

    const parsed = JSON.parse(content);
    return ProductAnalysisSchema.parse(parsed);
  } finally {
    clearTimeout(timer);
  }
}
