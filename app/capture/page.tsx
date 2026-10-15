'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Bookmark, Copy, Check, ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function CaptureBookmarkletPage() {
  const [token, setToken] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Check if user has a token in localStorage or search query
    const saved = localStorage.getItem('crumbs_capture_token');
    if (saved) setToken(saved);
  }, []);

  const bookmarkletCode = `javascript:(function(){
    var url = window.location.href;
    var title = document.title;
    var ogImg = document.querySelector('meta[property="og:image"]')?.content || '';
    var twImg = document.querySelector('meta[name="twitter:image"]')?.content || '';
    var firstImg = document.querySelector('img')?.src || '';
    var candidates = [ogImg, twImg, firstImg].filter(Boolean);
    
    var token = "${token || 'YOUR_TOKEN'}";
    if (!token || token === 'YOUR_TOKEN') {
      token = prompt('Enter your crumbs capture token (from crumbsbypixel.vercel.app/settings):');
      if (!token) return;
    }

    var banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;background:#262523;color:#EFEBE4;padding:12px 20px;border-radius:14px;font-family:system-ui;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;';
    banner.innerText = 'saving to crumbs...';
    document.body.appendChild(banner);

    fetch('https://crumbsbypixel.vercel.app/api/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        product_url: url,
        page_title: title,
        image_candidates: candidates
      })
    }).then(function(r){ return r.json(); })
      .then(function(res){
        if (res.crumb) {
          banner.style.background = '#2E7D32';
          banner.innerText = 'saved to crumbs! 🍞';
        } else {
          banner.style.background = '#C62828';
          banner.innerText = 'failed to save';
        }
        setTimeout(function(){ banner.remove(); }, 2500);
      }).catch(function(){
        banner.style.background = '#C62828';
        banner.innerText = 'error saving piece';
        setTimeout(function(){ banner.remove(); }, 2500);
      });
  })();`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <Header user={null} activeCategory="all" onCategoryChange={() => {}} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          back to board
        </Link>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-serif text-ink tracking-tight">crumbs bookmarklet</h1>
            <p className="text-xs text-muted mt-1">
              save products and inspiration from any browser without installing an extension
            </p>
          </div>

          <div className="bg-surface/60 border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-card">
            <div className="space-y-3">
              <span className="text-xs font-semibold text-ink uppercase tracking-wider font-mono">
                step 1: drag to bookmarks bar
              </span>
              <p className="text-xs text-muted leading-relaxed">
                drag the button below into your browser&apos;s bookmarks bar. if your bookmarks bar is hidden, press{' '}
                <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded font-mono text-[10px]">Ctrl+Shift+B</kbd>{' '}
                (or <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded font-mono text-[10px]">Cmd+Shift+B</kbd> on Mac).
              </p>

              <div className="pt-2">
                <a
                  href={bookmarkletCode}
                  onClick={(e) => {
                    if (!token) {
                      e.preventDefault();
                      alert('Tip: generate a token in /settings first so the bookmarklet saves directly to your account!');
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-ink text-canvas rounded-2xl text-xs font-medium cursor-grab active:cursor-grabbing hover:bg-ink-light transition-all shadow-soft"
                >
                  <Bookmark className="w-4 h-4 fill-current" />
                  + save to crumbs
                </a>
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <span className="text-xs font-semibold text-ink uppercase tracking-wider font-mono">
                step 2: personalize with your token
              </span>
              <p className="text-xs text-muted leading-relaxed">
                enter your capture token below (from{' '}
                <Link href="/settings" className="text-ink underline">
                  /settings
                </Link>
                ) to embed it into the bookmarklet button above:
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value.trim());
                    localStorage.setItem('crumbs_capture_token', e.target.value.trim());
                  }}
                  placeholder="paste crmb_... token from /settings"
                  className="flex-1 px-3.5 py-2 text-xs bg-canvas border border-border rounded-xl text-ink font-mono focus:outline-none focus:ring-1 focus:ring-ink/20"
                />
                <button
                  onClick={copyBookmarklet}
                  className="px-4 py-2 border border-border bg-canvas hover:bg-surface rounded-xl text-xs font-medium text-ink flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'copied!' : 'copy code'}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-border text-xs text-muted">
              <span className="font-medium text-ink">works on mobile?</span> save the bookmarklet URL in your mobile Safari or Chrome bookmarks. When viewing any shopping page, open bookmarks and tap &quot;save to crumbs&quot;.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
