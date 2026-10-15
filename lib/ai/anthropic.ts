import Anthropic from '@anthropic-ai/sdk';
import { type AnalyzeProductInput, type ProductAnalysis, ProductAnalysisSchema } from './types';

export async function analyzeWithAnthropic(
  input: AnalyzeProductInput
): Promise<ProductAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const anthropic = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

  const systemPrompt = `You are a visual moodboard curator and product cataloging expert.
Examine the image first to identify the item, its materials, silhouette, aesthetic, and category.
Use title and metadata only as supplementary hints.
Never invent a brand; set brand to null unless visible on the item or explicitly provided.`;

  const contentParts: Anthropic.MessageParam['content'] = [];

  if (input.imageBytes && input.imageBytes.length > 0) {
    const base64 = Buffer.isBuffer(input.imageBytes)
      ? input.imageBytes.toString('base64')
      : Buffer.from(input.imageBytes).toString('base64');
    const rawMime = input.mimeType || 'image/jpeg';
    const mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
      rawMime === 'image/png' || rawMime === 'image/gif' || rawMime === 'image/webp'
        ? rawMime
        : 'image/jpeg';

    contentParts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    });
  }

  contentParts.push({
    type: 'text',
    text: `Analyze this product and call the "record_product_analysis" tool with your assessment.

Title: "${input.title || 'Untitled item'}"
Product URL: "${input.productUrl || ''}"
${input.pageMeta?.brand ? `Brand hint: "${input.pageMeta.brand}"` : ''}
${input.pageMeta?.price ? `Price hint: "${input.pageMeta.price}"` : ''}`,
  });

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: contentParts,
      },
    ],
    tools: [
      {
        name: 'record_product_analysis',
        description: 'Record structured taxonomy and aesthetic attributes of the analyzed product.',
        input_schema: {
          type: 'object',
          properties: {
            item_type: {
              type: 'string',
              description: 'Precise specific product type, e.g. "trench coat", "ballet flat", "candle", "armchair"',
            },
            category: {
              type: 'string',
              enum: ['clothes', 'shoes & accessories', 'home & living', 'tools & tech', 'curios'],
              description: 'The single best matching category out of the 5 allowed categories',
            },
            brand: {
              type: ['string', 'null'],
              description: 'Brand name if visibly branded or explicitly mentioned in title/meta, otherwise null',
            },
            colors: {
              type: 'array',
              items: { type: 'string' },
              description: '1 to 3 dominant color names, plain lowercase words',
            },
            materials: {
              type: 'array',
              items: { type: 'string' },
              description: 'Materials detected from image or title',
            },
            aesthetic: {
              type: 'array',
              items: { type: 'string' },
              description: '1 to 3 aesthetic vibes (e.g. minimalist, vintage, y2k, cottagecore, industrial)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '5 to 10 lowercase descriptive search tags',
            },
            confidence: {
              type: 'number',
              description: 'Confidence score between 0 and 1',
            },
          },
          required: [
            'item_type',
            'category',
            'brand',
            'colors',
            'materials',
            'aesthetic',
            'tags',
            'confidence',
          ],
        },
      },
    ],
    tool_choice: {
      type: 'tool',
      name: 'record_product_analysis',
    },
  });

  const toolUseBlock = response.content.find(
    (b) => b.type === 'tool_use' && b.name === 'record_product_analysis'
  );

  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error('Claude did not return a structured tool response');
  }

  const validated = ProductAnalysisSchema.parse(toolUseBlock.input);
  return validated;
}
