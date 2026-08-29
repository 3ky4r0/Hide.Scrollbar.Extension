const assert = require('assert');

// Mock globalThis.ScrollHideConstants
global.globalThis = global;
global.ScrollHideConstants = {
    RESTRICTED_HOSTS: ['chromewebstore.google.com'],
    RESTRICTED_PROTOCOLS: ['chrome:', 'edge:', 'about:', 'chrome-extension:']
};

// Load the service
require('../src/features/whitelist/whitelist-service.js');
const service = global.ScrollHideWhitelist;

function runTests() {
    console.log('--- Đang chạy Unit Test cho Whitelist Service ---');

    // Test sanitizeDomain
    assert.strictEqual(service.sanitizeDomain('https://google.com/path'), 'google.com');
    assert.strictEqual(service.sanitizeDomain('  GOOGLE.COM  '), 'google.com');
    assert.strictEqual(service.sanitizeDomain('http://xyz.vn?q=1'), 'xyz.vn');
    console.log('✅ sanitizeDomain: OK');

    // Test normalizeWhitelist
    const input = ['Google.com', '  youtube.com  ', 'google.com', ''];
    const normalized = service.normalizeWhitelist(input);
    assert.deepStrictEqual(normalized, ['google.com', 'youtube.com']);
    console.log('✅ normalizeWhitelist: OK');

    // Test isWhitelisted
    const whitelist = ['google.com', 'github.com'];
    assert.strictEqual(service.isWhitelisted('google.com', whitelist), true);
    assert.strictEqual(service.isWhitelisted('bing.com', whitelist), false);
    console.log('✅ isWhitelisted: OK');

    // Test isRestrictedUrl
    assert.strictEqual(service.isRestrictedUrl('chrome://settings'), true);
    assert.strictEqual(service.isRestrictedUrl('https://wikipedia.org'), false);
    assert.strictEqual(service.isRestrictedUrl('https://chromewebstore.google.com/detail/123'), true);
    assert.strictEqual(service.isRestrictedUrl('https://chrome.google.com/'), false);
    console.log('✅ isRestrictedUrl: OK');

    console.log('--- Tất cả các bài test đã VƯỢT QUA! ---');
}

try {
    runTests();
} catch (error) {
    console.error('❌ Test thất bại:');
    console.error(error);
    process.exit(1);
}
