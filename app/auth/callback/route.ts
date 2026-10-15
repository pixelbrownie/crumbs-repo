import { createClient } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const errorParam = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');

  // Handle forwarded proto/host from Vercel edge proxy
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost = request.headers.get('x-forwarded-host') || requestUrl.host;
  const baseUrl = `${forwardedProto}://${forwardedHost}`;

  const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (errorParam) {
    console.error('[auth/callback] OAuth error from provider:', errorParam);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorParam)}`, baseUrl));
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(destination, baseUrl));
    }
    console.error('[auth/callback] Error exchanging code for session:', error.message);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, baseUrl));
  }

  return NextResponse.redirect(new URL('/login?error=auth', baseUrl));
}
