import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET /api/user/avatar — fetch the current user's profile avatar image
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('userId');

  let userId: string | null = targetUserId;
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const avatarPath = `${userId}/profile-avatar.jpg`;
    const { data: blob, error } = await supabase.storage
      .from('crumb-images')
      .download(avatarPath);

    if (error || !blob) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': blob.type || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.warn('[api/user/avatar] Error reading avatar:', err);
    return NextResponse.json({ error: 'Failed to retrieve avatar' }, { status: 500 });
  }
}

// POST /api/user/avatar — upload new cropped avatar
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Limit to 500KB
    if (file.size > 500 * 1024) {
      return NextResponse.json({ error: 'Avatar image must be under 500KB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const avatarPath = `${user.id}/profile-avatar.jpg`;

    // Upload with upsert: true so it overwrites existing avatar
    const { error: uploadError } = await supabase.storage
      .from('crumb-images')
      .upload(avatarPath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('[api/user/avatar] Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload avatar to storage' }, { status: 500 });
    }

    // Save a clean, short URL (ONLY ~30 bytes!) into user_metadata
    // Never put base64 data URLs into user_metadata because cookies will exceed 494/431 limits
    const cleanAvatarUrl = `/api/user/avatar?v=${Date.now()}`;
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      data: {
        avatar_url: cleanAvatarUrl,
      },
    });

    if (updateError) {
      console.error('[api/user/avatar] User metadata update error:', updateError);
      return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      avatar_url: cleanAvatarUrl,
      user: updateData.user,
    });
  } catch (err) {
    console.error('[api/user/avatar] Fatal POST error:', err);
    return NextResponse.json({ error: 'Unexpected error saving avatar' }, { status: 500 });
  }
}

// DELETE /api/user/avatar — remove avatar
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const avatarPath = `${user.id}/profile-avatar.jpg`;
    await supabase.storage.from('crumb-images').remove([avatarPath]);

    const { data, error } = await supabase.auth.updateUser({
      data: {
        avatar_url: null,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data.user });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete avatar' }, { status: 500 });
  }
}
