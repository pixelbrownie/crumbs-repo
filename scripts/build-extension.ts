import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');

const rootDir = process.cwd();
const extDir = path.resolve(rootDir, 'extension');
const srcDir = path.resolve(extDir, 'src');
const distDir = path.resolve(extDir, 'dist');
const zipFile = path.resolve(extDir, 'crumbs-extension.zip');

async function build() {
  console.log('Building crumbs Chrome extension...');

  // 1. Ensure dist directory exists
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 2. Build TypeScript entry points with esbuild
  const entryPoints = [
    { in: path.join(srcDir, 'background.ts'), out: 'background' },
    { in: path.join(srcDir, 'content.ts'), out: 'content' },
    { in: path.join(srcDir, 'popup.ts'), out: 'popup' },
    { in: path.join(srcDir, 'options.ts'), out: 'options' },
  ];

  await esbuild.build({
    entryPoints,
    outdir: distDir,
    bundle: true,
    minify: false,
    target: ['chrome110'],
    format: 'iife',
    platform: 'browser',
    sourcemap: false,
  });

  console.log('✓ Compiled TypeScript scripts to extension/dist');

  // 3. Copy manifest, HTML, and icons
  fs.copyFileSync(path.join(extDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
  fs.copyFileSync(path.join(srcDir, 'popup.html'), path.join(distDir, 'popup.html'));
  fs.copyFileSync(path.join(srcDir, 'options.html'), path.join(distDir, 'options.html'));

  const iconsSrcDir = path.join(extDir, 'icons');
  const iconsDistDir = path.join(distDir, 'icons');
  fs.mkdirSync(iconsDistDir, { recursive: true });

  for (const size of [16, 32, 48, 128]) {
    const iconName = `icon-${size}.png`;
    const src = path.join(iconsSrcDir, iconName);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(iconsDistDir, iconName));
    }
  }

  console.log('✓ Copied manifest, HTML, and icons to extension/dist');

  // 4. Create ZIP archive
  if (fs.existsSync(zipFile)) {
    fs.unlinkSync(zipFile);
  }

  const output = fs.createWriteStream(zipFile);
  const archive = new ZipArchive({ zlib: { level: 9 } });

  await new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(distDir, false);
    archive.finalize();
  });

  const zipStats = fs.statSync(zipFile);
  console.log(`✓ Packaged extension zip: ${zipFile} (${(zipStats.size / 1024).toFixed(1)} KB)`);
  console.log('Done! Extension ready to load unpacked or distribute.');
}

build().catch((err) => {
  console.error('Build error:', err);
  process.exit(1);
});
