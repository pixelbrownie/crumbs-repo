import Link from 'next/link';

export const metadata = {
  title: 'privacy policy — crumbs',
  description: 'every piece you love. minimal, privacy-conscious visual bookmarking.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-canvas py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link href="/" className="text-xl font-serif font-medium tracking-tight text-ink hover:opacity-85">
            crumbs
          </Link>
          <h1 className="text-3xl font-serif font-medium text-ink tracking-tight pt-2">
            privacy policy
          </h1>
          <p className="text-xs text-muted font-mono">Last updated: October 2026</p>
        </header>

        <section className="space-y-4 text-sm text-ink/80 leading-relaxed">
          <p>
            At <strong>crumbs</strong> (&ldquo;every piece you love&rdquo;), we believe bookmarking the pieces you cherish should be private, beautiful, and completely devoid of advertising surveillance.
          </p>

          <h2 className="text-base font-semibold text-ink pt-4">1. What We Collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Account Information:</strong> When you register with email/password or Google OAuth, we store your authentication identifier and email address to manage your account and secure your personal board.
            </li>
            <li>
              <strong>Saved Pieces:</strong> When you save a product via our extension, bookmarklet, or website, we store the product URL, title, selected image, and AI-generated categorization tags (such as item type, category, brand, aesthetic, and color palette).
            </li>
            <li>
              <strong>Capture Tokens:</strong> When you connect the Chrome extension or bookmarklet, an encrypted token hash is stored to authenticate your capture requests.
            </li>
          </ul>

          <h2 className="text-base font-semibold text-ink pt-4">2. How We Use Information</h2>
          <p>
            We process your saved pieces solely to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Display your personal visual moodboard.</li>
            <li>Run privacy-safe AI vision analysis to automatically categorize and sort your pieces into smart boards.</li>
            <li>Enable quick search and filtering across your saved collection.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your data, use your browsing habits for targeted advertising, or track your browsing activity outside of explicit capture requests you trigger.
          </p>

          <h2 className="text-base font-semibold text-ink pt-4">3. Extension Single-Purpose &amp; Permissions</h2>
          <p>
            The crumbs Chrome Extension has a single purpose: <em>to allow users to send products they discover on the web into their crumbs board with one click</em>.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>activeTab:</strong> Only accesses the current page when you click the extension icon or trigger a capture command, strictly to discover product images and page metadata.
            </li>
            <li>
              <strong>storage:</strong> Stores your capture token locally in Chrome sync storage to authenticate your requests.
            </li>
            <li>
              <strong>contextMenus:</strong> Enables the &ldquo;Save to crumbs&rdquo; right-click shortcut on images and links.
            </li>
          </ul>

          <h2 className="text-base font-semibold text-ink pt-4">4. Data Deletion &amp; Export</h2>
          <p>
            You have full ownership of your data. You can delete any saved piece at any time from your board, or revoke your extension capture tokens in your settings.
          </p>

          <h2 className="text-base font-semibold text-ink pt-4">5. Contact</h2>
          <p>
            For questions about this policy or data requests, visit{' '}
            <Link href="https://crumbsbypixel.vercel.app" className="underline text-ink">
              crumbsbypixel.vercel.app
            </Link>.
          </p>
        </section>

        <footer className="pt-8 border-t border-border flex justify-between items-center text-xs text-muted">
          <span>crumbs — every piece you love.</span>
          <Link href="/" className="hover:text-ink underline">
            Return to board
          </Link>
        </footer>
      </div>
    </div>
  );
}
