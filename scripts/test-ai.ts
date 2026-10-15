/**
 * Phase 1 Test Script: scripts/test-ai.ts
 * Runs 10 sample products through lib/ai and outputs side-by-side comparison.
 */

import fs from 'node:fs';
import path from 'node:path';
import { SAMPLE_PRODUCTS } from './sample-data';
import { analyzeWithGemini } from '../lib/ai/gemini';
import { analyzeWithAnthropic } from '../lib/ai/anthropic';
import type { ProductAnalysis } from '../lib/ai/types';

// Load .env.local
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

async function runComparison() {
  console.log('='.repeat(100));
  console.log('PHASE 1: PROVIDER-AGNOSTIC AI VISION BENCHMARK');
  console.log('='.repeat(100));
  console.log(`Gemini Key:    ${process.env.GEMINI_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`Anthropic Key: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Missing (Add ANTHROPIC_API_KEY to test Claude)'}`);
  console.log(`Default Provider: ${process.env.AI_PROVIDER || 'gemini'}\n`);

  console.log(
    'ID'.padEnd(4) +
    'Item'.padEnd(24) +
    'Expected'.padEnd(20) +
    'Gemini Category'.padEnd(22) +
    'Gemini Tags (Sample)'.padEnd(30)
  );
  console.log('-'.repeat(100));

  for (const item of SAMPLE_PRODUCTS) {
    try {
      const imgRes = await fetch(item.imageUrl, { signal: AbortSignal.timeout(8000) });
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const mimeType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];

      let geminiRes: ProductAnalysis | null = null;
      try {
        geminiRes = await analyzeWithGemini({
          imageBytes: buf,
          mimeType,
          title: item.title,
          productUrl: item.productUrl,
        });
      } catch (err: unknown) {
        console.error(`Gemini err on #${item.id}:`, err instanceof Error ? err.message : err);
      }

      let anthropicRes: ProductAnalysis | null = null;
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          anthropicRes = await analyzeWithAnthropic({
            imageBytes: buf,
            mimeType,
            title: item.title,
            productUrl: item.productUrl,
          });
        } catch (err: unknown) {
          console.error(`Anthropic err on #${item.id}:`, err instanceof Error ? err.message : err);
        }
      }

      const geminiCat = geminiRes ? geminiRes.category : 'FAILED';
      const geminiMatch = geminiCat === item.expectedCategory ? '✓' : '✗';
      const tagsStr = geminiRes ? geminiRes.tags.slice(0, 3).join(', ') : '-';

      console.log(
        item.id.padEnd(4) +
        item.name.padEnd(24) +
        item.expectedCategory.padEnd(20) +
        `${geminiMatch} ${geminiCat}`.padEnd(22) +
        tagsStr.padEnd(30)
      );

      if (anthropicRes) {
        const anthropicMatch = anthropicRes.category === item.expectedCategory ? '✓' : '✗';
        console.log(
          ''.padEnd(4) +
          '└─ Claude:'.padEnd(24) +
          item.expectedCategory.padEnd(20) +
          `${anthropicMatch} ${anthropicRes.category}`.padEnd(22) +
          anthropicRes.tags.slice(0, 3).join(', ').padEnd(30)
        );
      }
    } catch (err: unknown) {
      console.log(`${item.id.padEnd(4)} ${item.name.padEnd(24)} FETCH ERROR: ${err}`);
    }
  }

  console.log('='.repeat(100));
}

runComparison().catch(console.error);
