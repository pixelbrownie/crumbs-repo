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

// GET /api/profile — fetch authenticated user's profile and stats
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const defaultUsername = cleanUsername(
    user.user_metadata?.username ||
      user.user_metadata?.display_name ||
      user.email?.split('@')[0] ||
      'user'
  );

  let profile = {
    id: user.id,
    username: defaultUsername,
    display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'you',
    avatar_url: user.user_metadata?.avatar_url || null,
    bio: user.user_metadata?.bio || '',
    is_public: user.user_metadata?.is_public !== false,
    followers_count: 0,
    following_count: 0,
  };

  // Try fetching from profiles table
  try {
    const { data: dbProfile, error: dbError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!dbError && dbProfile) {
      profile = {
        ...profile,
        ...dbProfile,
      };
    }
  } catch {
    // profiles table may not be created yet, fallback to user_metadata
  }

  // Count user crumbs
  let crumbsCount = 0;
  try {
    const { count } = await supabase
      .from('crumbs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    crumbsCount = count || 0;
  } catch {
    // ignore
  }

  return NextResponse.json({
    profile,
    crumbsCount,
  });
}

// PATCH /api/profile — update profile (username, display_name, bio, is_public)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rawUsername = typeof body.username === 'string' ? body.username : undefined;
    const displayName = typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 50) : undefined;
    const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 200) : undefined;
    const isPublic = typeof body.is_public === 'boolean' ? body.is_public : undefined;

    let newUsername = user.user_metadata?.username;

    if (rawUsername !== undefined) {
      const cleaned = cleanUsername(rawUsername);
      if (cleaned.length < 3) {
        return NextResponse.json(
          { error: 'Username must be at least 3 characters long.' },
          { status: 400 }
        );
      }
      if (RESERVED_USERNAMES.has(cleaned)) {
        return NextResponse.json(
          { error: `The username "${cleaned}" is reserved. Please pick another.` },
          { status: 400 }
        );
      }

      // Check if username is taken in profiles table
      try {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', cleaned)
          .neq('id', user.id)
          .maybeSingle();

        if (existingUser) {
          return NextResponse.json(
            { error: `Username @${cleaned} is already taken. Please choose another.` },
            { status: 409 }
          );
        }
      } catch {
        // Table might not exist yet
      }

      newUsername = cleaned;
    }

    // 1. Update Supabase Auth user_metadata
    const metadataUpdates: Record<string, unknown> = {};
    if (newUsername !== undefined) metadataUpdates.username = newUsername;
    if (displayName !== undefined) {
      metadataUpdates.display_name = displayName;
      metadataUpdates.full_name = displayName;
    }
    if (bio !== undefined) metadataUpdates.bio = bio;
    if (isPublic !== undefined) metadataUpdates.is_public = isPublic;

    const { data: updatedAuth, error: updateAuthErr } = await supabase.auth.updateUser({
      data: metadataUpdates,
    });

    if (updateAuthErr) {
      throw updateAuthErr;
    }

    // 2. Upsert into profiles table if available
    try {
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          username: newUsername || cleanUsername(user.email?.split('@')[0] || 'user'),
          display_name: displayName ?? user.user_metadata?.display_name ?? null,
          bio: bio ?? user.user_metadata?.bio ?? '',
          is_public: isPublic ?? user.user_metadata?.is_public ?? true,
          avatar_url: user.user_metadata?.avatar_url ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch {
      // profiles table might not be migrated yet
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: user.id,
        username: newUsername,
        display_name: displayName ?? user.user_metadata?.display_name,
        bio: bio ?? user.user_metadata?.bio,
        is_public: isPublic ?? user.user_metadata?.is_public ?? true,
        avatar_url: user.user_metadata?.avatar_url,
      },
    });
  } catch (err) {
    console.error('[api/profile] Error updating profile:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update profile' },
      { status: 500 }
    );
  }
}
