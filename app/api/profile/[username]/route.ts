import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { getCrumbImageUrl } from '@/lib/crumbImages';
import type { Crumb, Category } from '@/types/crumb';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const { username: rawUsername } = await context.params;
  const username = rawUsername.toLowerCase().trim().replace(/^@+/, '');

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  let profileData: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string;
    is_public: boolean;
    followers_count: number;
    following_count: number;
  } | null = null;

  // 1. Query profiles table by username
  try {
    const { data: dbProfile, error: dbError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', username)
      .maybeSingle();

    if (!dbError && dbProfile) {
      profileData = dbProfile;
    }
  } catch {
    // profiles table might not be migrated yet
  }

  // 2. If not found in profiles table, check if currentUser matches this username
  if (!profileData && currentUser) {
    const currentUsername = (
      currentUser.user_metadata?.username ||
      currentUser.user_metadata?.display_name ||
      currentUser.email?.split('@')[0] ||
      ''
    ).toLowerCase();

    if (currentUsername === username) {
      profileData = {
        id: currentUser.id,
        username,
        display_name: currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'you',
        avatar_url: currentUser.user_metadata?.avatar_url || null,
        bio: currentUser.user_metadata?.bio || '',
        is_public: currentUser.user_metadata?.is_public !== false,
        followers_count: 0,
        following_count: 0,
      };
    }
  }

  if (!profileData) {
    return NextResponse.json(
      { error: `User @${username} not found.` },
      { status: 404 }
    );
  }

  const isOwner = currentUser?.id === profileData.id;

  // Check if current user is following this profile
  let isFollowing = false;
  if (currentUser && !isOwner) {
    try {
      const { data: followRow } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', profileData.id)
        .maybeSingle();

      isFollowing = Boolean(followRow);
    } catch {
      // non-blocking
    }
  }

  // Retrieve accurate follower and following counts from follows table
  try {
    const { count: fCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profileData.id);
    if (typeof fCount === 'number') {
      profileData.followers_count = fCount;
    }

    const { count: fingCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profileData.id);
    if (typeof fingCount === 'number') {
      profileData.following_count = fingCount;
    }
  } catch {
    // fallback to stored counts
  }

  // Count pieces
  let crumbsCount = 0;
  try {
    const { count } = await supabase
      .from('crumbs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profileData.id);
    crumbsCount = count || 0;
  } catch {
    // ignore
  }

  // If public or viewing own profile, retrieve crumbs
  let crumbs: Crumb[] = [];
  if (profileData.is_public || isOwner) {
    try {
      const { data: dbCrumbs } = await supabase
        .from('crumbs')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false });

      if (dbCrumbs && dbCrumbs.length > 0) {
        // Resolve storage image URLs
        crumbs = await Promise.all(
          dbCrumbs.map(async (c: any) => {
            const resolvedImg = await getCrumbImageUrl(supabase, c.image_url);
            const category: Category = c.category === 'curios' ? 'misc' : c.category;
            return {
              ...c,
              image_url: resolvedImg,
              category,
            };
          })
        );
      }
    } catch {
      // crumbs fetch fallback
    }
  }

  return NextResponse.json({
    profile: profileData,
    crumbsCount,
    crumbs,
    isOwner,
    isFollowing,
  });
}
