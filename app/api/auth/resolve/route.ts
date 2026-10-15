import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = (body.identifier || '').trim();

    if (!raw) {
      return NextResponse.json({ error: 'Please enter your username or email' }, { status: 400 });
    }

    // If it's already an email, return directly
    if (raw.includes('@') && raw.includes('.')) {
      return NextResponse.json({ email: raw.toLowerCase() });
    }

    const cleanUsername = raw.toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_.-]/g, '');

    if (!cleanUsername) {
      return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Try PostgreSQL function get_email_for_username
    try {
      const { data: rpcEmail, error: rpcError } = await supabase.rpc(
        'get_email_for_username',
        { p_username: cleanUsername }
      );
      if (!rpcError && rpcEmail && typeof rpcEmail === 'string') {
        return NextResponse.json({ email: rpcEmail });
      }
    } catch {
      // fallback
    }

    // 2. Try username_lookups table
    try {
      const { data: lookup, error: lookupError } = await supabase
        .from('username_lookups')
        .select('email')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (!lookupError && lookup?.email) {
        return NextResponse.json({ email: lookup.email });
      }
    } catch {
      // fallback
    }

    // 3. Try profiles table
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (!profileError && profile?.email) {
        return NextResponse.json({ email: profile.email });
      }
    } catch {
      // fallback
    }

    return NextResponse.json(
      { error: `No account found with username @${cleanUsername}. Please check your username or sign in with your email.` },
      { status: 404 }
    );
  } catch (err) {
    console.error('[api/auth/resolve] Error:', err);
    return NextResponse.json(
      { error: 'Could not resolve username. Please use your email to sign in.' },
      { status: 500 }
    );
  }
}
