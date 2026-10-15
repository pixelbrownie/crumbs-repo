'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Header from '@/components/Header';
import { Plus, Trash2, Copy, Check, Key, ShieldCheck, ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface TokenItem {
  id: string;
  label: string;
  created_at: string;
  last_used_at?: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [createdRawToken, setCreatedRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
      } else {
        loadTokens();
      }
    });
  }, [router, supabase]);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/capture/token');
      if (res.ok) {
        const { tokens } = await res.json();
        setTokens(tokens || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/capture/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim() || 'browser extension' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate token');

      setCreatedRawToken(data.token);
      setNewLabel('');
      loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating token');
    }
  };

  const handleRevokeToken = async (id: string) => {
    if (!confirm('Revoke this capture token? Connected extensions using it will be disconnected.')) return;
    try {
      const res = await fetch(`/api/capture/token?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTokens((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <Header user={null} activeCategory="all" onCategoryChange={() => router.push('/')} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to board
          </Link>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-sans font-semibold tracking-tight text-ink">settings</h1>
            <p className="text-xs text-muted mt-1">manage your browser extension capture tokens and connections</p>
          </div>

          {/* Capture Tokens Section */}
          <section className="bg-surface/50 border border-border rounded-2xl p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-medium text-ink flex items-center gap-2">
                  <Key className="w-4 h-4 text-ink-light" />
                  capture tokens
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  tokens allow the crumbs chrome extension and bookmarklet to securely save products to your board.
                </p>
              </div>
              <Link
                href="/capture"
                className="text-xs text-ink underline hover:text-ink-light flex items-center gap-1"
              >
                bookmarklet
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {/* Created Token Alert */}
            {createdRawToken && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    token generated — copy it now (will not be shown again)
                  </span>
                  <button
                    onClick={() => copyToClipboard(createdRawToken)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-emerald-600 text-canvas rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'copied!' : 'copy token'}
                  </button>
                </div>
                <div className="font-mono text-xs text-emerald-900 bg-white/70 p-2 rounded border border-emerald-200 break-all select-all">
                  {createdRawToken}
                </div>
              </div>
            )}

            {/* Create Form */}
            <form onSubmit={handleCreateToken} className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="token label (e.g. work macbook chrome)"
                className="flex-1 px-3.5 py-2 text-xs bg-canvas border border-border rounded-xl text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-ink text-canvas text-xs font-medium rounded-xl hover:bg-ink-light transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                generate token
              </button>
            </form>

            {error && <p className="text-xs text-rose-500">{error}</p>}

            {/* Token List */}
            <div className="space-y-2">
              {loading ? (
                <div className="text-xs text-muted py-4">loading tokens...</div>
              ) : tokens.length === 0 ? (
                <div className="text-xs text-muted py-4 text-center border border-dashed border-border rounded-xl">
                  no capture tokens yet. generate one above or connect via the extension.
                </div>
              ) : (
                tokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex items-center justify-between p-3 bg-canvas border border-border rounded-xl text-xs"
                  >
                    <div>
                      <div className="font-medium text-ink">{token.label}</div>
                      <div className="text-[11px] text-muted">
                        created {new Date(token.created_at).toLocaleDateString()}
                        {token.last_used_at && ` • last used ${new Date(token.last_used_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeToken(token.id)}
                      className="p-1.5 text-muted hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Revoke token"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Extension Quick Connect */}
          <section className="bg-surface/50 border border-border rounded-2xl p-6">
            <h2 className="text-base font-medium text-ink">one-click browser connection</h2>
            <p className="text-xs text-muted mt-1 mb-4">
              if you have the crumbs chrome extension installed, connect it in one click without copying tokens manually.
            </p>
            <Link
              href="/connect"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface hover:bg-surface-hover border border-border rounded-xl text-xs font-medium text-ink transition-colors"
            >
              go to extension connection page
              <ExternalLink className="w-3 h-3" />
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
