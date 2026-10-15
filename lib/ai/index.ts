import {
  type AnalyzeProductInput,
  type ProductAnalysis,
  type Category,
  ProductAnalysisSchema,
  FALLBACK_ANALYSIS,
} from './types';
import { analyzeWithGemini } from './gemini';
import { analyzeWithAnthropic } from './anthropic';

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

  // Attempt analysis with 1 retry on parse failure
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      let analysis: ProductAnalysis;

      if (provider === 'anthropic') {
        analysis = await analyzeWithAnthropic(input);
      } else {
        analysis = await analyzeWithGemini(input);
      }

      // Final validation pass
      return ProductAnalysisSchema.parse(analysis);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[lib/ai] Provider ${provider} attempt ${attempt} failed: ${msg}`);

      if (attempt === 1) {
        // Wait 300ms before retry
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  // Graceful fallback: never throw to the user
  console.warn('[lib/ai] All provider attempts exhausted, using smart fallback.');
  return extractSmartFallback(input);
}
