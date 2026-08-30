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
const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../_locales/en/messages.json'), 'utf8'));
const vi = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../_locales/vi/messages.json'), 'utf8'));
const enKeys = Object.keys(en);
const viKeys = Object.keys(vi);
assert(enKeys.length === viKeys.length, `Locale key counts match (EN: ${enKeys.length}, VI: ${viKeys.length})`);
const missingInVi = enKeys.filter(k => !vi[k]);
assert(missingInVi.length === 0, `All EN keys present in VI (Missing: ${missingInVi.join(', ') || 'none'})`);
const missingInEn = viKeys.filter(k => !en[k]);
assert(missingInEn.length === 0, `All VI keys present in EN (Missing: ${missingInEn.join(', ') || 'none'})`);

// 3. Verify HTML and Referenced Assets
console.log('\n--- 3. Testing HTML references and files ---');
function checkHtmlFile(relPath) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  assert(fs.existsSync(fullPath), `HTML file exists: ${relPath}`);
  const content = fs.readFileSync(fullPath, 'utf8');
  const dir = path.dirname(fullPath);

  // Script tags
  const scriptMatches = content.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/g);
  for (const m of scriptMatches) {
    if (!m[1].startsWith('http')) {
      const target = path.resolve(dir, m[1]);
      assert(fs.existsSync(target), `Script exists in ${relPath}: ${m[1]}`);
    }
  }

  // Link stylesheet tags
  const linkMatches = content.matchAll(/<link\s+[^>]*href=["']([^"']+)["']/g);
  for (const m of linkMatches) {
    if (!m[1].startsWith('http')) {
      const target = path.resolve(dir, m[1]);
      assert(fs.existsSync(target), `Stylesheet exists in ${relPath}: ${m[1]}`);
    }
  }

  // Img tags
  const imgMatches = content.matchAll(/<img\s+[^>]*src=["']([^"']+)["']/g);
  for (const m of imgMatches) {
    if (m[1] && !m[1].startsWith('http') && !m[1].startsWith('data:')) {
      const target = path.resolve(dir, m[1]);
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
require('../src/shared/constants.js');
require('../src/features/whitelist/whitelist-service.js');
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

console.log('\n======================================================');
if (allPassed) {
  console.log('🎉 TẤT CẢ CÁC BÀI KIỂM TRA ĐỀU TRƠN TRU & ĐẠT 100%!');
} else {
  console.error('❌ CÓ LỖI XẢY RA TRONG QUÁ TRÌNH KIỂM TRA!');
  process.exit(1);
}
console.log('======================================================\n');
