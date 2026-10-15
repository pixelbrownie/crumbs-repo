import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !currentUser) {
    return NextResponse.json({ error: 'Please sign in to follow profiles' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { target_user_id, username, action = 'toggle' } =
    (body as {
      target_user_id?: string;
      username?: string;
      action?: 'follow' | 'unfollow' | 'toggle';
    }) || {};

  let targetId = target_user_id;

  // Resolve target ID from username if needed
  if (!targetId && username) {
    const cleanUsername = username.toLowerCase().trim().replace(/^@+/, '');
    const { data: prof } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (prof?.id) {
      targetId = prof.id;
    }
  }

  if (!targetId) {
    return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
  }

  if (targetId === currentUser.id) {
    return NextResponse.json({ error: 'You cannot follow yourself' }, { status: 400 });
  }

  try {
    // 1. Check existing follow status
    const { data: existingFollow } = await supabase
      .from('follows')
      .select('follower_id, following_id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', targetId)
      .maybeSingle();

    const isCurrentlyFollowing = Boolean(existingFollow);
    const shouldFollow = action === 'toggle' ? !isCurrentlyFollowing : action === 'follow';

    if (shouldFollow) {
      // Follow
      if (!isCurrentlyFollowing) {
        await supabase.from('follows').insert({
          follower_id: currentUser.id,
          following_id: targetId,
        });

        // Update follower counts in profiles table
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('followers_count')
          .eq('id', targetId)
          .maybeSingle();

        const newCount = (targetProfile?.followers_count || 0) + 1;
        await supabase
          .from('profiles')
          .update({ followers_count: newCount })
          .eq('id', targetId);

        const { data: myProfile } = await supabase
          .from('profiles')
          .select('following_count')
          .eq('id', currentUser.id)
          .maybeSingle();

        await supabase
          .from('profiles')
          .update({ following_count: (myProfile?.following_count || 0) + 1 })
          .eq('id', currentUser.id);

        return NextResponse.json({
          success: true,
          is_following: true,
          followers_count: newCount,
        });
      } else {
        return NextResponse.json({
          success: true,
          is_following: true,
        });
      }
    } else {
      // Unfollow
      if (isCurrentlyFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', targetId);

        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('followers_count')
          .eq('id', targetId)
          .maybeSingle();

        const newCount = Math.max(0, (targetProfile?.followers_count || 1) - 1);
        await supabase
          .from('profiles')
          .update({ followers_count: newCount })
          .eq('id', targetId);

        const { data: myProfile } = await supabase
          .from('profiles')
          .select('following_count')
          .eq('id', currentUser.id)
          .maybeSingle();

        await supabase
          .from('profiles')
          .update({ following_count: Math.max(0, (myProfile?.following_count || 1) - 1) })
          .eq('id', currentUser.id);

        return NextResponse.json({
          success: true,
          is_following: false,
          followers_count: newCount,
        });
      } else {
        return NextResponse.json({
          success: true,
          is_following: false,
        });
      }
    }
  } catch (err) {
    console.error('[follow] Error updating follow state:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update follow state' },
      { status: 500 }
    );
  }
}
