/**
 * Phase 0 & Phase 1 Test Script: scripts/test-ai.ts
 * Tests 10 diverse sample product images across categories and providers.
 */

import fs from 'node:fs';
import path from 'node:path';

// Load environment variables from .env.local if present
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

export interface SampleProduct {
  id: string;
  name: string;
  expectedCategory: string;
  imageUrl: string;
  productUrl: string;
  title: string;
}

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: '1',
    name: 'Trench Coat',
    expectedCategory: 'clothes',
    imageUrl: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/oversized-trench-coat',
    title: 'Oversized Wool Blend Trench Coat in Sand',
  },
  {
    id: '2',
    name: 'Ballet Flats',
    expectedCategory: 'shoes & accessories',
    imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/leather-mary-jane-flats',
    title: 'Leather Square-Toe Mary Jane Ballet Flats',
  },
  {
    id: '3',
    name: 'Leather Shoulder Bag',
    expectedCategory: 'shoes & accessories',
    imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/minimalist-leather-tote',
    title: 'Minimalist Structured Leather Tote Bag',
  },
  {
    id: '4',
    name: 'Ceramic Table Lamp',
    expectedCategory: 'home & living',
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/terracotta-ceramic-lamp',
    title: 'Handmade Terracotta Ceramic Table Lamp',
  },
  {
    id: '5',
    name: 'Linen Lounge Chair',
    expectedCategory: 'home & living',
    imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/scandinavian-armchair',
    title: 'Scandinavian Modern Oak and Linen Armchair',
  },
  {
    id: '6',
    name: 'Scented Candle',
    expectedCategory: 'home & living',
    imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/amber-smoke-candle',
    title: 'Amber & Hinoki Wood Soy Wax Scented Candle',
  },
  {
    id: '7',
    name: 'Over-Ear Headphones',
    expectedCategory: 'tools & tech',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/wireless-anc-headphones',
    title: 'Matte Charcoal Wireless Noise Cancelling Headphones',
  },
  {
    id: '8',
    name: 'Mechanical Keyboard',
    expectedCategory: 'tools & tech',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/custom-mechanical-keyboard',
    title: 'Custom Aluminum 75% Mechanical Keyboard with PBT Keycaps',
  },
  {
    id: '9',
    name: 'Minimalist Art Print',
    expectedCategory: 'curios',
    imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/abstract-botanical-print',
    title: 'Framed Archival Abstract Botanical Woodblock Art Print',
  },
  {
    id: '10',
    name: 'Architecture Monograph Book',
    expectedCategory: 'curios',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/modernist-architecture-book',
    title: 'Hardcover Monograph: Mid-Century Modern Architecture in Japan',
  },
];

async function runBaseline() {
  console.log('='.repeat(80));
  console.log('PHASE 0: RUNNING BASELINE AI CATEGORIZATION TEST (10 SAMPLES)');
  console.log('='.repeat(80));
  console.log(`Using GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Present (ending in ...' + process.env.GEMINI_API_KEY.slice(-4) + ')' : 'MISSING'}`);
  console.log(`Using GEMINI_MODEL: ${process.env.GEMINI_MODEL || 'default'}\n`);

  const results: Array<{
    id: string;
    name: string;
    expected: string;
    gotCategory: string;
    success: boolean;
    durationMs: number;
    notes?: string;
  }> = [];

  for (const item of SAMPLE_PRODUCTS) {
    const start = Date.now();
    try {
      // Fetch image bytes to test real server-side image fetching
      const imgRes = await fetch(item.imageUrl);
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const base64 = buf.toString('base64');
      const mimeType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];

      // Call our internal Gemini vision logic
      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = process.env.GEMINI_API_KEY || '';
      const genAI = new GoogleGenAI({ apiKey });
      const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

      const prompt = `Analyze this product image and classify it into exactly one of these categories:
["clothes", "shoes & accessories", "home & living", "tools & tech", "curios"].

Title: "${item.title}"
Product URL: "${item.productUrl}"

Respond ONLY with valid JSON: {"category": "..."}`;

      const res = await genAI.models.generateContent({
        model,
        contents: [
          { inlineData: { mimeType, data: base64 } },
          { text: prompt },
        ] as unknown as string,
      });

      const durationMs = Date.now() - start;
      const text = res.text?.trim() || '';
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      const gotCategory = parsed.category || 'unknown';
      const success = gotCategory === item.expectedCategory;

      results.push({
        id: item.id,
        name: item.name,
        expected: item.expectedCategory,
        gotCategory,
        success,
        durationMs,
      });

      console.log(`[${success ? 'PASS' : 'FAIL'}] #${item.id} ${item.name}`);
      console.log(`       Expected: "${item.expectedCategory}" | Got: "${gotCategory}" (${durationMs}ms)`);
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        id: item.id,
        name: item.name,
        expected: item.expectedCategory,
        gotCategory: 'ERROR',
        success: false,
        durationMs,
        notes: msg,
      });
      console.log(`[ERROR] #${item.id} ${item.name}: ${msg} (${durationMs}ms)`);
    }
  }

  const passed = results.filter((r) => r.success).length;
  console.log('\n' + '='.repeat(80));
  console.log(`BASELINE SUMMARY: ${passed}/${results.length} PASSED (${Math.round((passed / results.length) * 100)}%)`);
  console.log('='.repeat(80));
}

runBaseline().catch(console.error);
