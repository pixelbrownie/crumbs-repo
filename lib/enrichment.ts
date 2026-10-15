import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { analyzeProduct } from './ai';
import { downloadImageWithReferer, inspectImage, createFallbackPlaceholderTile } from './imageProcessor';
import type { Category, CollectionKind } from '@/types/crumb';

interface EnrichmentParams {
  crumbId: string;
  userId: string;
  productUrl: string;
  sourceDomain?: string;
  imageCandidates: string[];
  title?: string | null;
  pageMeta?: Record<string, unknown>;
}

/**
 * Finds or creates a smart collection and joins the crumb to it.
 */
async function linkToCollection(
  supabase: SupabaseClient,
  userId: string,
  crumbId: string,
  name: string,
  kind: CollectionKind
) {
  const cleanName = name.trim().toLowerCase();
  if (!cleanName || cleanName.length < 2) return;

  const slug = cleanName
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) return;

  try {
    // 1. Get or create collection
    let collectionId: string | null = null;
    const { data: existing } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', kind)
      .eq('slug', slug)
      .maybeSingle();

    if (existing?.id) {
      collectionId = existing.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('collections')
        .insert({
          user_id: userId,
          name: cleanName,
          kind,
          slug,
        })
        .select('id')
        .maybeSingle();

      if (!insertError && inserted?.id) {
        collectionId = inserted.id;
      }
    }

    // 2. Link crumb to collection
    if (collectionId) {
      await supabase
        .from('crumb_collections')
        .insert({
          crumb_id: crumbId,
          collection_id: collectionId,
        })
        .select()
        .maybeSingle();
    }
  } catch (err) {
    console.warn(`[lib/enrichment] Error linking to collection ${name}:`, err);
  }
}

/**
 * Performs full asynchronous enrichment of a newly captured crumb.
 */
export async function enrichCrumb(
  supabase: SupabaseClient,
  params: EnrichmentParams
) {
  const {
    crumbId,
    userId,
    productUrl,
    sourceDomain = new URL(productUrl).hostname.replace(/^www\./, ''),
    imageCandidates,
    title,
    pageMeta,
  } = params;

  try {
    // 1. Download and process image
    let downloaded: { buffer: Buffer; mimeType: string } | null = null;
    let chosenSourceUrl: string | null = null;
    let existingStoragePath: string | null = null;

    for (const cand of imageCandidates) {
      if (!cand) continue;

      // Check if candidate is already in Supabase storage
      const storagePrefix = '/storage/v1/object/public/crumb-images/';
      let rawStoragePath: string | null = null;
      if (cand.includes(storagePrefix)) {
        rawStoragePath = decodeURIComponent(cand.slice(cand.indexOf(storagePrefix) + storagePrefix.length).split('?')[0]);
      } else if (!cand.startsWith('http://') && !cand.startsWith('https://') && !cand.startsWith('data:')) {
        rawStoragePath = cand;
      }

      if (rawStoragePath) {
        try {
          const { data: blob, error: dlErr } = await supabase.storage
            .from('crumb-images')
            .download(rawStoragePath);
          if (blob && !dlErr) {
            const buffer = Buffer.from(await blob.arrayBuffer());
            const mimeType = blob.type || 'image/jpeg';
            if (buffer.length > 50) {
              downloaded = { buffer, mimeType };
              chosenSourceUrl = cand;
              existingStoragePath = rawStoragePath;
              break;
            }
          }
        } catch (storageErr) {
          console.warn('[enrichment] Storage direct download failed, trying network fallback:', storageErr);
        }
      }

      downloaded = await downloadImageWithReferer(cand, productUrl);
      if (downloaded) {
        chosenSourceUrl = cand;
        break;
      }
    }

    // Fallback tile if no candidates succeeded
    if (!downloaded) {
      downloaded = createFallbackPlaceholderTile(sourceDomain);
      chosenSourceUrl = null;
    }

    const { width, height, blurDataUrl } = inspectImage(downloaded.buffer, downloaded.mimeType);

    // 2. Storage URL (reuse existing path if already in storage, else upload)
    let finalStorageUrl: string;
    if (existingStoragePath) {
      finalStorageUrl = existingStoragePath;
    } else {
      const ext = downloaded.mimeType.includes('png')
        ? 'png'
        : downloaded.mimeType.includes('webp')
        ? 'webp'
        : downloaded.mimeType.includes('svg')
        ? 'svg'
        : 'jpg';
      const hash = crypto.randomBytes(8).toString('hex');
      const storagePath = `${userId}/${Date.now()}-${hash}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('crumb-images')
        .upload(storagePath, downloaded.buffer, {
          contentType: downloaded.mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.warn('[lib/enrichment] Storage upload failed, falling back to source URL:', uploadError.message);
        finalStorageUrl = chosenSourceUrl || `data:${downloaded.mimeType};base64,${downloaded.buffer.toString('base64')}`;
      } else {
        finalStorageUrl = storagePath;
      }
    }

    // 3. AI Vision Analysis
    let analysis;
    try {
      analysis = await analyzeProduct({
        imageBytes: downloaded.buffer,
        mimeType: downloaded.mimeType,
        title: title || undefined,
        productUrl,
        pageMeta,
      });
    } catch (aiErr) {
      console.error('[lib/enrichment] AI analysis error:', aiErr);
    }

    // 4. Update the crumb row
    const isSuccess = !!analysis;
    const updateData = {
      image_url: finalStorageUrl,
      original_image_url: chosenSourceUrl,
      width,
      height,
      blur_data_url: blurDataUrl,
      source_domain: sourceDomain,
      status: isSuccess ? 'ready' : 'failed',
      ...(analysis
        ? {
            category: analysis.category as Category,
            item_type: analysis.item_type,
            brand: analysis.brand,
            colors: analysis.colors,
            materials: analysis.materials,
            aesthetic: analysis.aesthetic,
            tags: analysis.tags,
          }
        : {}),
    };

    await supabase
      .from('crumbs')
      .update(updateData)
      .eq('id', crumbId);

    // 5. Smart auto-grouping into collections (Phase 6)
    if (analysis) {
      // Category collection
      await linkToCollection(supabase, userId, crumbId, analysis.category, 'category');

      // Aesthetic collections (one per tag)
      for (const aes of analysis.aesthetic || []) {
        await linkToCollection(supabase, userId, crumbId, aes, 'aesthetic');
      }

      // Dominant color collection
      if (analysis.colors && analysis.colors.length > 0) {
        await linkToCollection(supabase, userId, crumbId, analysis.colors[0], 'color');
      }

      // Brand collection
      if (analysis.brand) {
        await linkToCollection(supabase, userId, crumbId, analysis.brand, 'brand');
      }
    }
  } catch (fatalErr) {
    console.error('[lib/enrichment] Fatal enrichment error:', fatalErr);
    await supabase
      .from('crumbs')
      .update({ status: 'failed' })
      .eq('id', crumbId);
  }
}
