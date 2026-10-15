import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all user collections with member crumb counts
    const { data: collections, error: colError } = await supabase
      .from('collections')
      .select('id, name, kind, slug, created_at, crumb_collections(crumb_id)')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (colError) {
      return NextResponse.json({ error: colError.message }, { status: 500 });
    }

    const formatted = (collections || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      slug: c.slug,
      created_at: c.created_at,
      count: Array.isArray(c.crumb_collections) ? c.crumb_collections.length : 0,
    }));

    return NextResponse.json({ collections: formatted });
  } catch (err) {
    console.error('[collections] Error fetching collections:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
