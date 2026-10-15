import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { generateCaptureToken, getCorsHeaders } from '@/lib/security';

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

// GET /api/capture/token — list active tokens for user
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const { data: tokens, error } = await supabase
    .from('capture_tokens')
    .select('id, label, created_at, last_used_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ tokens }, { status: 200, headers: corsHeaders });
}

// POST /api/capture/token — create a new token (raw token returned once!)
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  let label = 'browser extension';
  try {
    const body = await req.json();
    if (body.label && typeof body.label === 'string') {
      label = body.label.slice(0, 50).trim() || label;
    }
  } catch {
    // default label
  }

  const { rawToken, tokenHash } = generateCaptureToken();

  const { data: inserted, error } = await supabase
    .from('capture_tokens')
    .insert({
      user_id: user.id,
      token_hash: tokenHash,
      label,
    })
    .select('id, label, created_at')
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message || 'Failed to create token' }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json(
    {
      id: inserted.id,
      label: inserted.label,
      created_at: inserted.created_at,
      token: rawToken, // Shown only once upon creation
    },
    { status: 201, headers: corsHeaders }
  );
}

// DELETE /api/capture/token?id=... — revoke a token
export async function DELETE(req: NextRequest) {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Token id is required' }, { status: 400, headers: corsHeaders });
  }

  const { error } = await supabase
    .from('capture_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
}
