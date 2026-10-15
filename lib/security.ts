import crypto from 'node:crypto';

/**
 * SSRF Protection: Ensures an outbound URL does not resolve to local or private networks.
 */
export function isSafePublicUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Loopback & hostnames
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname === '0.0.0.0'
    ) {
      return false;
    }

    // IPv4 private & link-local ranges
    const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
    if (ipv4Match) {
      const [_, a, b] = ipv4Match.map(Number);
      if (a === 127) return false; // 127.0.0.0/8 Loopback
      if (a === 10) return false; // 10.0.0.0/8 Private
      if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12 Private
      if (a === 192 && b === 168) return false; // 192.168.0.0/16 Private
      if (a === 169 && b === 254) return false; // 169.254.0.0/16 Link-local / AWS metadata
      if (a === 0) return false;
    }

    // IPv6 loopback and private
    if (
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname.startsWith('fe80:') ||
      hostname.startsWith('fc00:') ||
      hostname.startsWith('fd00:')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Hashes a raw capture token using SHA-256 for database storage.
 */
export function hashCaptureToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Generates a high-entropy raw capture token and its hash.
 */
export function generateCaptureToken(): { rawToken: string; tokenHash: string } {
  const randomBytes = crypto.randomBytes(32).toString('base64url');
  const rawToken = `crmb_${randomBytes}`;
  const tokenHash = hashCaptureToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Checks CORS headers against allowed extension and origin patterns.
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowedPatterns = (
    process.env.EXTENSION_ALLOWED_ORIGINS || 'chrome-extension://*,http://localhost:3000,https://crumbsbypixel.vercel.app'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let allowOrigin = 'https://crumbsbypixel.vercel.app';

  if (requestOrigin) {
    const isAllowed = allowedPatterns.some((pattern) => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return requestOrigin.startsWith(prefix);
      }
      return requestOrigin === pattern;
    });

    if (isAllowed) {
      allowOrigin = requestOrigin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
