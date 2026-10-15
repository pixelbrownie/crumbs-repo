import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { enrichCrumb } from '@/lib/enrichment';
import { getCrumbImageUrl } from '@/lib/crumbImages';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { crumb_id, all = false, category } = body as {
      crumb_id?: string;
      all?: boolean;
      category?: string;
    };

    // Bulk re-sorting (e.g. re-sorting all curios or all crumbs)
    if (all || crumb_id === 'all') {
      let query = supabase
        .from('crumbs')
        .select('*')
        .eq('user_id', user.id);

      if (category) {
        query = query.eq('category', category);
      }

      const { data: crumbs, error: listError } = await query;
      if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }

      // Re-enrich each crumb
      for (const crumb of crumbs || []) {
        try {
          const imageCandidate = crumb.original_image_url || crumb.image_url;
          await enrichCrumb(supabase, {
            crumbId: crumb.id,
            userId: user.id,
            productUrl: crumb.product_url,
            sourceDomain: crumb.source_domain,
            imageCandidates: [imageCandidate],
            title: crumb.title,
          });
        } catch (crumbErr) {
          console.warn(`[resort] Failed to re-enrich crumb ${crumb.id}:`, crumbErr);
        }
      }

      return NextResponse.json({
        success: true,
        count: crumbs?.length || 0,
        message: `Successfully re-analyzed and sorted ${crumbs?.length || 0} pieces.`,
      });
    }

    if (!crumb_id || typeof crumb_id !== 'string') {
      return NextResponse.json({ error: 'crumb_id is required' }, { status: 400 });
    }

    // Single crumb re-sorting
    const { data: crumb, error: fetchError } = await supabase
      .from('crumbs')
      .select('*')
      .eq('id', crumb_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !crumb) {
      return NextResponse.json({ error: 'Crumb not found' }, { status: 404 });
    }

    // Reset status to pending and remove old collection links
    await supabase
      .from('crumbs')
      .update({ status: 'pending' })
      .eq('id', crumb.id);

    await supabase
      .from('crumb_collections')
      .delete()
      .eq('crumb_id', crumb.id);

    // Asynchronously or directly enrich
    const imageCandidate = crumb.original_image_url || crumb.image_url;

    // Trigger enrichment
    await enrichCrumb(supabase, {
      crumbId: crumb.id,
      userId: user.id,
      productUrl: crumb.product_url,
      sourceDomain: crumb.source_domain,
      imageCandidates: [imageCandidate],
      title: crumb.title,
    });

    // Fetch refreshed crumb
    const { data: refreshed } = await supabase
      .from('crumbs')
      .select('*')
      .eq('id', crumb.id)
      .single();

    const signedUrl = refreshed?.image_url ? await getCrumbImageUrl(supabase, refreshed.image_url) : '';

    return NextResponse.json({
      success: true,
      crumb: {
        ...refreshed,
        image_url: signedUrl,
      },
    });
  } catch (err) {
    console.error('[resort] Error re-sorting crumb:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Re-sort failed' },
      { status: 500 }
    );
  }
}
