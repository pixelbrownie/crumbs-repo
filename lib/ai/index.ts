import {
  type AnalyzeProductInput,
  type ProductAnalysis,
  type Category,
  ProductAnalysisSchema,
  FALLBACK_ANALYSIS,
} from './types';
import { analyzeWithGemini } from './gemini';
import { analyzeWithAnthropic } from './anthropic';
import { analyzeWithGrok } from './grok';

export * from './types';

function extractSmartFallback(input: AnalyzeProductInput): ProductAnalysis {
  const text = `${input.title || ''} ${input.productUrl || ''}`.toLowerCase();

  let category: Category = 'curios';
  let itemType = 'piece';

  if (/\b(dress|jacket|coat|blazer|shirt|top|pants|trousers|jeans|sweater|hoodie|skirt|shorts|swimsuit|vest|knit)\b/.test(text)) {
    category = 'clothes';
    itemType = 'clothing';
  } else if (/\b(shoe|shoes|sneaker|boots|heels|flats|loafers|bag|handbag|purse|tote|backpack|wallet|jewelry|necklace|ring|earring|sunglasses|hat|cap|belt)\b/.test(text)) {
    category = 'shoes & accessories';
    itemType = 'accessory';
  } else if (/\b(chair|table|lamp|candle|vase|rug|pillow|blanket|bedding|ceramic|mug|cup|plate|decor|furniture|kitchen)\b/.test(text)) {
    category = 'home & living';
    itemType = 'home good';
  } else if (/\b(headphone|headphones|earbuds|speaker|audio|keyboard|mouse|laptop|phone|case|charger|camera|gadget|tech)\b/.test(text)) {
    category = 'tools & tech';
    itemType = 'tech accessory';
  }

  const rawTags = (input.title || 'curated piece')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6);

  const tags = Array.from(new Set([...rawTags, category, 'curated'])).slice(0, 7);

  return {
    ...FALLBACK_ANALYSIS,
    category,
    item_type: itemType,
    brand: input.pageMeta?.brand || null,
    tags: tags.length >= 5 ? tags : ['curated', 'piece', 'saved', category, 'minimal'],
  };
}

export async function analyzeProduct(
  input: AnalyzeProductInput
): Promise<ProductAnalysis> {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();

  // Attempt primary provider
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      let analysis: ProductAnalysis;

      if (provider === 'anthropic') {
        analysis = await analyzeWithAnthropic(input);
      } else if (provider === 'grok' || provider === 'xai') {
        analysis = await analyzeWithGrok(input);
      } else {
        analysis = await analyzeWithGemini(input);
      }

      return ProductAnalysisSchema.parse(analysis);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[lib/ai] Provider '${provider}' attempt ${attempt} failed: ${msg}`);

      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  // If primary provider failed and it wasn't Gemini, try Gemini as free backup if key exists
  if (provider !== 'gemini' && process.env.GEMINI_API_KEY) {
    try {
      console.log('[lib/ai] Attempting Gemini as backup provider...');
      const backup = await analyzeWithGemini(input);
      return ProductAnalysisSchema.parse(backup);
    } catch (geminiErr) {
      console.warn('[lib/ai] Backup Gemini also failed:', geminiErr);
    }
  }

  // Graceful fallback: never throw or hang
  console.warn('[lib/ai] Providers exhausted; using smart instant heuristic fallback.');
  return extractSmartFallback(input);
}
