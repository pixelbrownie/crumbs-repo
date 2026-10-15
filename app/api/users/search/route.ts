import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawQuery = searchParams.get('q') || '';
  const query = rawQuery.trim().replace(/^@+/, '').toLowerCase();

  if (!query || query.length < 1) {
    return NextResponse.json({ users: [] });
  }

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  try {
    // 1. Search profiles table by username or display_name
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, followers_count, following_count')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(8);

    if (profileErr) {
      console.warn('[users/search] Profile search error:', profileErr.message);
      return NextResponse.json({ users: [] });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const targetUserIds = profiles.map((p: any) => p.id);

    // 2. Check if current user follows these profiles
    const followingSet = new Set<string>();
    if (currentUser && targetUserIds.length > 0) {
      try {
        const { data: followRows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUser.id)
          .in('following_id', targetUserIds);

        if (followRows) {
          for (const f of followRows) {
            followingSet.add(f.following_id);
          }
        }
      } catch {
        // follows table may not exist yet
      }
    }

    // 3. Count pieces / crumbs for each user
    const crumbsCountMap: Record<string, number> = {};
    try {
      const { data: crumbsCounts } = await supabase
        .from('crumbs')
        .select('user_id')
        .in('user_id', targetUserIds);

      if (crumbsCounts) {
        for (const c of crumbsCounts) {
          crumbsCountMap[c.user_id] = (crumbsCountMap[c.user_id] || 0) + 1;
        }
      }
    } catch {
      // non-blocking
    }

    const formattedUsers = profiles.map((p: any) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name || p.username,
      avatar_url: p.avatar_url || null,
      bio: p.bio || '',
      followers_count: p.followers_count || 0,
      following_count: p.following_count || 0,
      crumbs_count: crumbsCountMap[p.id] || 0,
      is_following: followingSet.has(p.id),
      is_self: currentUser?.id === p.id,
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (err) {
    console.error('[users/search] Unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed', users: [] },
      { status: 500 }
    );
  }
}
