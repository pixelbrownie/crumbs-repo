import type { createClient } from '@/lib/supabaseServer';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

function getStoragePath(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;

    const publicStoragePrefix = '/storage/v1/object/public/crumb-images/';
    if (url.pathname.startsWith(publicStoragePrefix)) {
      return decodeURIComponent(url.pathname.slice(publicStoragePrefix.length));
    }
    return null;
  } catch {
    return imageUrl.startsWith('http://') || imageUrl.startsWith('https://')
      ? null
      : imageUrl;
  }
}

export async function getCrumbImageUrl(
  supabase: SupabaseServerClient,
  imageUrl: string
): Promise<string> {
  const path = getStoragePath(imageUrl);
  if (!path) return imageUrl;

  const { data, error } = await supabase.storage
    .from('crumb-images')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) {
    throw new Error(`Unable to create a private image URL: ${error.message}`);
  }

  return data.signedUrl;
}
