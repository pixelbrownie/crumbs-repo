import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const RESERVED_USERNAMES = new Set([
  'login',
  'signup',
  'settings',
  'share',
  'capture',
  'connect',
  'privacy',
  'api',
  'auth',
  'admin',
  'crumbs',
  'feed',
  'explore',
  'about',
  'dashboard',
]);

function cleanUsername(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 30);
}

// GET /api/auth/username?username=... — check if username is available
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('username') || '';
  const cleaned = cleanUsername(raw);

  if (!cleaned || cleaned.length < 3) {
    return NextResponse.json(
      { available: false, error: 'Username must be at least 3 characters long.' },
      { status: 400 }
    );
  }

  if (RESERVED_USERNAMES.has(cleaned)) {
    return NextResponse.json(
      { available: false, error: `@${cleaned} is a reserved system name. Please choose another.` },
      { status: 200 }
    );
  }

  const supabase = await createClient();

  // 1. Check in profiles table
  try {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', cleaned)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { available: false, error: `Username @${cleaned} is already taken. Please choose another.` },
        { status: 200 }
      );
    }
  } catch {
    // ignore if table not created yet
  }

  // 2. Check in username_lookups table
  try {
    const { data: existingLookup } = await supabase
      .from('username_lookups')
      .select('username')
      .ilike('username', cleaned)
      .maybeSingle();

    if (existingLookup) {
      return NextResponse.json(
        { available: false, error: `Username @${cleaned} is already taken. Please choose another.` },
        { status: 200 }
      );
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ available: true, username: cleaned });
}

// POST /api/auth/username — register username mapping after signup
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  try {
    const body = await req.json();
    const { username: rawUsername, email: rawEmail, userId } = body;

    const cleanedUsername = cleanUsername(rawUsername || '');
    const email = (rawEmail || '').toLowerCase().trim();

    if (!cleanedUsername || !email) {
      return NextResponse.json({ error: 'Username and email are required' }, { status: 400 });
    }

    // Insert into username_lookups
    try {
      await supabase.from('username_lookups').upsert(
        {
          username: cleanedUsername,
          email,
          user_id: userId || null,
        },
        { onConflict: 'username' }
      );
    } catch {
      // ignore
    }

    // Insert into profiles if userId provided
    if (userId) {
      try {
        await supabase.from('profiles').upsert(
          {
            id: userId,
            username: cleanedUsername,
            email,
            display_name: body.displayName || cleanedUsername,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ success: true, username: cleanedUsername });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to register username' },
      { status: 500 }
    );
  }
}
