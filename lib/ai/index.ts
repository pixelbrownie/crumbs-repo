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

export function detectCategoryFromText(
  text: string,
  customCategories?: string[]
): string | null {
  const t = text.toLowerCase();

  // 1. Check custom categories first (user preferences take priority!)
  if (customCategories && customCategories.length > 0) {
    for (const customCat of customCategories) {
      const c = customCat.trim().toLowerCase();
      if (!c || c === 'all' || c === 'misc') continue;
      const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
      if (pattern.test(t)) {
        return c;
      }
    }
  }

  // Clothes: tops, bottoms, outerwear, dresses, knitwear, activewear, intimates
  if (
    /\b(dress|dresses|gown|gowns|skirt|skirts|jacket|jackets|coat|coats|overcoat|trench|blazer|blazers|puffer|bomber|parka|fleece|windbreaker|shirt|shirts|t-shirt|tshirts|t-shirts|tee|tees|top|tops|tank|tanks|blouse|blouses|sweater|sweaters|knit|knits|knitwear|cardigan|cardigans|hoodie|hoodies|sweatshirt|sweatshirts|turtleneck|vest|vests|pants|trousers|trouser|jeans|denim|shorts|leggings|sweatpants|joggers|suit|suits|swimsuit|bikini|swimwear|bra|bras|lingerie|underwear|boxers|briefs|bodysuit|corset|camisole|cami|pajamas|sleepwear|jumpsuit|romper|apparel|clothing|garment)\b/.test(
      t
    )
  ) {
    return 'clothes';
  }

  // Shoes & Accessories: footwear, bags, jewelry, eyewear, headwear, leather goods
  if (
    /\b(shoe|shoes|sneaker|sneakers|boot|boots|heel|heels|flat|flats|loafer|loafers|sandal|sandals|mule|mules|clog|clogs|slipper|slippers|slide|slides|footwear|bag|bags|handbag|handbags|purse|purses|tote|totes|backpack|backpacks|wallet|wallets|cardholder|clutch|jewelry|jewellery|necklace|necklaces|ring|rings|earring|earrings|bracelet|bracelets|sunglasses|shades|eyewear|glasses|watch|watches|hat|hats|cap|caps|beanie|beanies|belt|belts|scarf|scarves|gloves)\b/.test(
      t
    )
  ) {
    return 'shoes & accessories';
  }

  // Home & Living: furniture, lighting, decor, tableware, kitchen, textiles
  if (
    /\b(chair|chairs|armchair|stool|stools|table|tables|sofa|sofas|couch|lamp|lamps|light|lighting|sconce|candle|candles|candleholder|vase|vases|rug|rugs|pillow|pillows|cushion|cushions|blanket|blankets|throw|throws|bedding|linen|linens|ceramic|ceramics|pottery|plate|plates|mug|mugs|cup|cups|bowl|bowls|glassware|glass|mirror|mirrors|furniture|decor|kitchen|planter|planters|diffuser)\b/.test(
      t
    )
  ) {
    return 'home & living';
  }

  // Tools & Tech: gadgets, electronics, audio, computing, cameras
  if (
    /\b(headphone|headphones|earbuds|airpods|speaker|speakers|audio|keyboard|keyboards|mouse|laptop|laptops|phone|phones|iphone|charger|chargers|case|cases|cable|cables|camera|cameras|monitor|monitors|display|gadget|gadgets|tech|hardware|electronics)\b/.test(
      t
    )
  ) {
    return 'tools & tech';
  }

  return null;
}

function extractSmartFallback(input: AnalyzeProductInput): ProductAnalysis {
  const text = `${input.title || ''} ${input.productUrl || ''}`.toLowerCase();
  const detectedCategory = detectCategoryFromText(text, input.customCategories);
  const category: string = detectedCategory || 'misc';

  let itemType = 'piece';
  if (category === 'clothes') itemType = 'clothing';
  else if (category === 'shoes & accessories') itemType = 'accessory';
  else if (category === 'home & living') itemType = 'home good';
  else if (category === 'tools & tech') itemType = 'tech item';

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
    aesthetic: [],
    tags: tags.length >= 2 ? tags : ['curated', category],
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
