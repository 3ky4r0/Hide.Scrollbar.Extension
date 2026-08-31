const fs = require('fs');
const path = require('path');

let allPassed = true;

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    allPassed = false;
  } else {
    console.log('✅ PASS:', message);
  }
}

// 1. Verify Manifest
console.log('\n--- 1. Testing manifest.json integrity ---');
const manifestPath = path.resolve(__dirname, '../manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json exists');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.manifest_version === 3, 'Manifest version is 3');
assert(manifest.options_ui && manifest.options_ui.page, 'options_ui is configured in manifest');
assert(fs.existsSync(path.resolve(__dirname, '..', manifest.options_ui.page)), `options_ui page exists: ${manifest.options_ui.page}`);
assert(manifest.action && manifest.action.default_popup, 'default_popup is configured in manifest');
assert(fs.existsSync(path.resolve(__dirname, '..', manifest.action.default_popup)), `default_popup exists: ${manifest.action.default_popup}`);

// 2. Verify Locales
console.log('\n--- 2. Testing Locales (_locales) ---');
const localesRoot = path.resolve(__dirname, '../_locales');
const en = JSON.parse(fs.readFileSync(path.join(localesRoot, 'en/messages.json'), 'utf8'));
const enKeys = Object.keys(en);

const allDirs = fs.readdirSync(localesRoot, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

assert(allDirs.length >= 20, `Locales directory contains ${allDirs.length} languages (expected >= 20)`);

allDirs.forEach((lang) => {
  const langFile = path.join(localesRoot, lang, 'messages.json');
  assert(fs.existsSync(langFile), `Locale file exists: _locales/${lang}/messages.json`);
  const dict = JSON.parse(fs.readFileSync(langFile, 'utf8'));
  const dictKeys = Object.keys(dict);
  assert(dictKeys.length === enKeys.length, `Locale [${lang}] key count (${dictKeys.length}) matches EN (${enKeys.length})`);
  const missing = enKeys.filter(k => !dict[k]);
  assert(missing.length === 0, `All EN keys present in [${lang}] (Missing: ${missing.join(', ') || 'none'})`);
});
console.log(`✅ All ${allDirs.length} locales passed verification with 100% key completeness!`);

// 3. Verify HTML and Referenced Assets (check against dist/ for script files)
console.log('\n--- 3. Testing HTML references and files ---');
const distRoot = path.resolve(__dirname, '../dist');
const srcRoot = path.resolve(__dirname, '..');

function checkHtmlFile(relPath) {
  // HTML source file must exist
  const srcFullPath = path.resolve(srcRoot, relPath);
  assert(fs.existsSync(srcFullPath), `HTML file exists: ${relPath}`);
  const content = fs.readFileSync(srcFullPath, 'utf8');
  
  // HTML must also exist in dist/
  const distFullPath = path.resolve(distRoot, relPath);
  assert(fs.existsSync(distFullPath), `HTML file in dist/: dist/${relPath}`);

  const distDir = path.dirname(distFullPath);

  // Script tags — resolve against dist/ (where .js files live)
  const scriptMatches = content.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/g);
  for (const m of scriptMatches) {
    if (!m[1].startsWith('http')) {
      const target = path.resolve(distDir, m[1]);
      assert(fs.existsSync(target), `Script exists in dist/${relPath}: ${m[1]}`);
    }
  }

  // Link stylesheet tags — resolve against src/ (CSS stays in src/)
  const srcDir = path.dirname(srcFullPath);
  const linkMatches = content.matchAll(/<link\s+[^>]*href=["']([^"']+)["']/g);
  for (const m of linkMatches) {
    if (!m[1].startsWith('http')) {
      const target = path.resolve(srcDir, m[1]);
      assert(fs.existsSync(target), `Stylesheet exists in ${relPath}: ${m[1]}`);
    }
  }

  // Img tags — resolve against src/
  const imgMatches = content.matchAll(/<img\s+[^>]*src=["']([^"']+)["']/g);
  for (const m of imgMatches) {
    if (m[1] && !m[1].startsWith('http') && !m[1].startsWith('data:')) {
      const target = path.resolve(srcDir, m[1]);
      assert(fs.existsSync(target), `Image exists in ${relPath}: ${m[1]}`);
    }
  }
}

checkHtmlFile('src/features/popup/popup.html');
checkHtmlFile('src/features/settings/settings.html');
checkHtmlFile('src/features/favicon/favicon.html');


// 4. Whitelist Service logic
console.log('\n--- 4. Testing Whitelist & Sanitization logic ---');
global.globalThis = global;
require('../dist/src/shared/constants.js');
require('../dist/src/features/whitelist/whitelist-service.js');
const service = global.ScrollHideWhitelist;

assert(service.sanitizeDomain('https://example.com/path?query=1') === 'example.com', 'Sanitize URL to domain');
assert(service.sanitizeDomain('! This is a comment') === '', 'Ignore comment starting with !');
assert(service.sanitizeDomain('# This is a comment') === '', 'Ignore comment starting with #');
assert(service.sanitizeDomain('   sub.domain.co.uk/   ') === 'sub.domain.co.uk', 'Sanitize subdomain with whitespace');

const list = service.normalizeWhitelist(['example.com', '  ! note', '  YOUTUBE.COM  ', 'example.com', '# note 2']);
assert(list.length === 2 && list[0] === 'example.com' && list[1] === 'youtube.com', 'Normalize whitelist deduplicates and strips comments');

assert(service.isWhitelisted('example.com', list) === true, 'isWhitelisted finds domain');
assert(service.isWhitelisted('sub.example.com', list) === true, 'isWhitelisted finds subdomain');
assert(service.isWhitelisted('other.com', list) === false, 'isWhitelisted returns false for non-listed site');

assert(service.isRestrictedUrl('chrome://settings') === true, 'Restricted on chrome://');
assert(service.isRestrictedUrl('edge://extensions') === true, 'Restricted on edge://');
assert(service.isRestrictedUrl('about:blank') === true, 'Restricted on about:');
assert(service.isRestrictedUrl('https://chromewebstore.google.com') === false, 'Chrome Web Store is NOT restricted');
assert(service.isRestrictedUrl('https://google.com') === false, 'google.com is NOT restricted');

// 5. Verify Dist Output
console.log('\n--- 5. Testing dist/ bundle integrity ---');
const distPath = path.resolve(__dirname, '../dist');
assert(fs.existsSync(distPath), 'dist/ directory exists');
assert(fs.existsSync(path.join(distPath, 'manifest.json')), 'dist/manifest.json exists');
assert(fs.existsSync(path.join(distPath, '_locales/en/messages.json')), 'dist/_locales/en/messages.json exists');
assert(fs.existsSync(path.join(distPath, '_locales/vi/messages.json')), 'dist/_locales/vi/messages.json exists');
assert(fs.existsSync(path.join(distPath, 'src/entries/background.js')), 'dist/src/entries/background.js compiled');
assert(fs.existsSync(path.join(distPath, 'src/entries/content.js')), 'dist/src/entries/content.js compiled');
assert(fs.existsSync(path.join(distPath, 'src/features/popup/popup.js')), 'dist/src/features/popup/popup.js compiled');
assert(fs.existsSync(path.join(distPath, 'src/features/ruler/ruler.js')), 'dist/src/features/ruler/ruler.js compiled');
assert(fs.existsSync(path.join(distPath, 'src/features/ruler/ruler.css')), 'dist/src/features/ruler/ruler.css exists');
assert(fs.existsSync(path.join(distPath, 'src/features/draw/draw.js')), 'dist/src/features/draw/draw.js compiled');
assert(fs.existsSync(path.join(distPath, 'src/features/draw/draw.css')), 'dist/src/features/draw/draw.css exists');
assert(fs.existsSync(path.join(distPath, 'src/features/settings/settings.js')), 'dist/src/features/settings/settings.js compiled');
assert(fs.existsSync(path.join(distPath, 'src/features/favicon/favicon.js')), 'dist/src/features/favicon/favicon.js compiled');

console.log('\n======================================================');
if (allPassed) {
  console.log('🎉 TẤT CẢ CÁC BÀI KIỂM TRA ĐỀU TRƠN TRU & ĐẠT 100%!');
} else {
  console.error('❌ CÓ LỖI XẢY RA TRONG QUÁ TRÌNH KIỂM TRA!');
  process.exit(1);
}
console.log('======================================================\n');
