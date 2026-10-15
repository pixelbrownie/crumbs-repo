import { z } from 'zod';

export const CATEGORIES = [
  'clothes',
  'shoes & accessories',
  'home & living',
  'tools & tech',
  'misc',
  'curios',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const ProductAnalysisSchema = z.object({
  item_type: z.string().describe('Precise specific product type, e.g. "trench coat", "ballet flat", "candle", "armchair"'),
  category: z.enum(CATEGORIES).describe('The single best matching category out of the 5 allowed categories'),
  brand: z.string().nullable().describe('Brand name if visibly branded or explicitly mentioned in title/meta, otherwise null'),
  colors: z.array(z.string()).min(1).max(3).describe('1 to 3 dominant color names, plain lowercase words like "sand", "black", "olive"'),
  materials: z.array(z.string()).describe('Materials detected from image or title, e.g. ["wool", "leather", "linen", "ceramic"]'),
  aesthetic: z.array(z.string()).min(0).max(3).describe('1 to 3 aesthetic vibes, e.g. ["minimalist", "vintage", "y2k", "cottagecore", "industrial", "modernist"]'),
  tags: z.array(z.string()).min(0).max(10).describe('descriptive search tags'),
  confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
});

export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;

export interface AnalyzeProductInput {
  imageBytes?: Buffer | Uint8Array;
  mimeType?: string;
  title?: string;
  productUrl?: string;
  pageMeta?: {
    brand?: string | null;
    price?: string | null;
    description?: string | null;
    siteName?: string | null;
    [key: string]: unknown;
  };
}

export const FALLBACK_ANALYSIS: ProductAnalysis = {
  item_type: 'item',
  category: 'misc',
  brand: null,
  colors: ['neutral'],
  materials: [],
  aesthetic: [],
  tags: ['curated', 'piece', 'saved'],
  confidence: 0.3,
};
