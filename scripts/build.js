const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

console.log('🚀 Building extension to dist/ ...');

// 1. Clean dist directory
if (!isWatch && fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 2. Type Check with tsc
console.log('🔍 Running TypeScript type check (tsc --noEmit)...');
try {
  execSync('npx tsc --noEmit', { cwd: rootDir, stdio: 'inherit' });
  console.log('✅ Type check passed!');
} catch (err) {
  console.error('❌ Type check failed. Please fix TypeScript errors.');
  if (!isWatch) process.exit(1);
}

// 3. Static Copy helper
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const child of fs.readdirSync(src)) {
      if (child === 'node_modules' || child === 'dist' || child === '.git') continue;
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    const ext = path.extname(src).toLowerCase();
    if (ext !== '.ts') {
      fs.copyFileSync(src, dest);
    }
  }
}

function copyAllStatic() {
  if (fs.existsSync(path.join(rootDir, 'manifest.json'))) {
    fs.copyFileSync(path.join(rootDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
  }
  if (fs.existsSync(path.join(rootDir, '_locales'))) {
    copyRecursive(path.join(rootDir, '_locales'), path.join(distDir, '_locales'));
  }
  if (fs.existsSync(path.join(rootDir, 'assets'))) {
    copyRecursive(path.join(rootDir, 'assets'), path.join(distDir, 'assets'));
  }

  function copySrcStatic(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relFromSrc = path.relative(path.join(rootDir, 'src'), fullPath);
      const destPath = path.join(distDir, 'src', relFromSrc);

      if (entry.isDirectory()) {
        copySrcStatic(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.html', '.css', '.svg', '.png', '.jpg', '.jpeg', '.ico', '.json'].includes(ext)) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(fullPath, destPath);
        }
      }
    }
  }
  copySrcStatic(path.join(rootDir, 'src'));
}

copyAllStatic();

// 4. Bundling with esbuild (IIFE format for MV3 Chrome Extension compatibility)
const entryPoints = {
  'src/entries/background': path.join(rootDir, 'src/entries/background.ts'),
  'src/entries/content': path.join(rootDir, 'src/entries/content.ts'),
  'src/features/popup/popup': path.join(rootDir, 'src/features/popup/popup.ts'),
  'src/features/settings/settings': path.join(rootDir, 'src/features/settings/settings.ts'),
  'src/features/ruler/ruler': path.join(rootDir, 'src/features/ruler/ruler.ts'),
  'src/features/favicon/favicon': path.join(rootDir, 'src/features/favicon/favicon.ts'),
  'src/features/sidepanel/sidepanel': path.join(rootDir, 'src/features/sidepanel/sidepanel.ts'),
  'src/shared/constants': path.join(rootDir, 'src/shared/constants.ts'),
  'src/shared/storage': path.join(rootDir, 'src/shared/storage.ts'),
  'src/shared/browser-api': path.join(rootDir, 'src/shared/browser-api.ts'),
  'src/shared/i18n': path.join(rootDir, 'src/shared/i18n.ts'),
  'src/features/whitelist/whitelist-service': path.join(rootDir, 'src/features/whitelist/whitelist-service.ts'),
};

const buildOptions = {
  entryPoints,
  outdir: distDir,
  bundle: false,
  format: 'iife',
  target: 'es2022',
  sourcemap: false,
};

async function build() {
  if (isWatch) {
    console.log('👀 Starting watch mode...');
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('⚡ Watching for changes...');
  } else {
    console.log('📦 Compiling with esbuild (IIFE - zero export syntax error)...');
    await esbuild.build(buildOptions);
    console.log('✨ Build complete! Output directory: dist/\n');
  }
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
