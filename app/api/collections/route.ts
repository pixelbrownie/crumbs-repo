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

// POST /api/collections — create a new custom board/collection
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name } = (body as { name?: string }) || {};
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Board name is required' }, { status: 400 });
  }

  const cleanName = name.trim().toLowerCase();
  if (cleanName.length < 2 || cleanName.length > 50) {
    return NextResponse.json({ error: 'Board name must be between 2 and 50 characters' }, { status: 400 });
  }

  const slug = cleanName
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    return NextResponse.json({ error: 'Invalid board name characters' }, { status: 400 });
  }

  try {
    // Check if collection already exists
    const { data: existing } = await supabase
      .from('collections')
      .select('id, name, kind, slug, created_at')
      .eq('user_id', user.id)
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        collection: { ...existing, count: 0 },
        created: false,
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('collections')
      .insert({
        user_id: user.id,
        name: cleanName,
        kind: 'custom',
        slug,
      })
      .select('id, name, kind, slug, created_at')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      collection: { ...inserted, count: 0 },
      created: true,
    }, { status: 201 });
  } catch (err) {
    console.error('[collections] Error creating board:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE /api/collections — delete a custom board and reassign crumbs to 'misc'
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  let id = searchParams.get('id');
  let name = searchParams.get('name');

  if (!id && !name) {
    try {
      const body = await req.json();
      id = body.id;
      name = body.name;
    } catch {
      // Non-blocking if body wasn't JSON
    }
  }

  if (!id && !name) {
    return NextResponse.json({ error: 'id or name is required' }, { status: 400 });
  }

  try {
    // Find the collection
    let colQuery = supabase
      .from('collections')
      .select('id, name')
      .eq('user_id', user.id);

    if (id) {
      colQuery = colQuery.eq('id', id);
    } else if (name) {
      const cleanName = name.trim().toLowerCase();
      colQuery = colQuery.ilike('name', cleanName);
    }

    const { data: targetCol, error: findError } = await colQuery.maybeSingle();

    if (findError || !targetCol) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Safely reassign crumbs with this category to 'misc'
    await supabase
      .from('crumbs')
      .update({ category: 'misc' })
      .eq('user_id', user.id)
      .ilike('category', targetCol.name);

    // Delete relationships from crumb_collections
    await supabase
      .from('crumb_collections')
      .delete()
      .eq('collection_id', targetCol.id);

    // Delete collection
    const { error: delError } = await supabase
      .from('collections')
      .delete()
      .eq('id', targetCol.id)
      .eq('user_id', user.id);

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: targetCol.name });
  } catch (err) {
    console.error('[collections] Error deleting board:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

