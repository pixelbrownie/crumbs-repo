'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ShieldCheck, Check, Loader2, ArrowLeft, Key } from 'lucide-react';
import Link from 'next/link';

export default function ConnectPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [manualToken, setManualToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login?redirect=/connect');
      } else {
        setUser({ id: user.id, email: user.email });
      }
    });
  }, [router, supabase]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      // 1. Generate capture token for the extension
      const res = await fetch('/api/capture/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'chrome extension auto-connect' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate token');

      const rawToken = data.token;
      setManualToken(rawToken);

      // 2. Transmit to extension via window.postMessage (captured by extension content script)
      // and via chrome.runtime if extension ID is present in URL searchParams
      const searchParams = new URLSearchParams(window.location.search);
      const extId = searchParams.get('ext_id');

      let handedOff = false;

      // Broadcast via DOM event for content script
      window.postMessage(
        {
          type: 'CRUMBS_CONNECT_TOKEN',
          token: rawToken,
          email: user?.email,
        },
        '*'
      );

      // Try chrome.runtime.sendMessage if extension ID specified
      if (typeof window !== 'undefined' && (window as unknown as { chrome?: { runtime?: { sendMessage: Function } } }).chrome?.runtime?.sendMessage && extId) {
        try {
          (window as unknown as { chrome: { runtime: { sendMessage: Function } } }).chrome.runtime.sendMessage(
            extId,
            { type: 'CRUMBS_CONNECT_TOKEN', token: rawToken, email: user?.email },
            (response: unknown) => {
              if (response) handedOff = true;
            }
          );
        } catch {
          // fallback to postMessage
        }
      }

      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <span className="font-sans text-3xl font-semibold tracking-tight text-ink">crumbs</span>
          <p className="text-xs text-muted mt-1">connect your chrome extension</p>
        </div>

        <div className="bg-surface/70 border border-border rounded-3xl p-6 text-left space-y-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-canvas border border-border flex items-center justify-center flex-none">
              <ShieldCheck className="w-4 h-4 text-ink" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink">authorize extension</div>
              <div className="text-[11px] text-muted">signed in as {user.email}</div>
            </div>
          </div>

          <p className="text-xs text-ink-light leading-relaxed">
            connecting allows you to save any product, piece, or visual discovery anywhere on the web directly into your board in one click.
          </p>

          {connected ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
              <div className="w-8 h-8 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-xs font-medium text-emerald-900">
                extension connected!
              </div>
              <p className="text-[11px] text-emerald-700">
                you can close this tab and start saving pieces with the crumbs extension.
              </p>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full py-3 bg-ink text-canvas text-xs font-medium rounded-xl hover:bg-ink-light transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  connecting...
                </>
              ) : (
                'connect extension'
              )}
            </button>
          )}

          {error && <p className="text-xs text-rose-500 text-center">{error}</p>}

          {/* Manual Token Fallback */}
          {manualToken && (
            <div className="pt-3 border-t border-border space-y-1.5">
              <span className="text-[10px] text-muted uppercase tracking-wider font-mono flex items-center gap-1">
                <Key className="w-3 h-3" /> manual token fallback
              </span>
              <p className="text-[11px] text-muted">
                if not auto-detected, paste this in the extension options:
              </p>
              <div className="p-2 bg-canvas border border-border rounded-lg font-mono text-[11px] text-ink break-all select-all">
                {manualToken}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted">
          <Link href="/" className="hover:text-ink transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            back to board
          </Link>
          <span>•</span>
          <Link href="/settings" className="hover:text-ink transition-colors">
            manage tokens
          </Link>
        </div>
      </div>
    </div>
  );
}
