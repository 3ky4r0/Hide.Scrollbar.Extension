/**
 * color-picker.js — Content script for the Color Picker feature.
 *
 * Flow:
 *  1. Background sends { action: 'PICK_COLOR' } via chrome.runtime.onMessage
 *  2. This script opens the EyeDropper API (Chrome 95+)
 *  3. On success: copies hex to clipboard, then sends hex back to background
 *     so background can show a system notification via chrome.notifications
 */

(function () {
  'use strict';

  // Prevent double-injection
  if (globalThis.__ScrollHideColorPickerLoaded) return;
  globalThis.__ScrollHideColorPickerLoaded = true;

  /* ── Clipboard helper ─────────────────────────────────────── */

  async function copyToClipboard (text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // Fallback: execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (_2) {
        return false;
      }
    }
  }

  /* ── EyeDropper ───────────────────────────────────────────── */

  async function pickColor () {
    if (!('EyeDropper' in window)) {
      chrome.runtime.sendMessage({
        action: 'COLOR_PICKED',
        hex: null,
        error: 'not_supported',
      });
      return;
    }

    try {
      const dropper = new window.EyeDropper();
      const result  = await dropper.open(); // user picks a pixel

      const hex    = result.sRGBHex;        // e.g. "#a3c4f5"
      const copied = await copyToClipboard(hex);

      // Notify background → system notification
      chrome.runtime.sendMessage({
        action: 'COLOR_PICKED',
        hex,
        copied,
        error: null,
      });
    } catch (err) {
      // AbortError = user pressed Escape — do nothing
      if (err && err.name === 'AbortError') return;

      chrome.runtime.sendMessage({
        action: 'COLOR_PICKED',
        hex: null,
        error: 'eyedropper_error',
      });
    }
  }

  /* ── Message listener ─────────────────────────────────────── */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.action === 'PICK_COLOR') {
      pickColor();
      sendResponse({ ok: true });
    }
    return false;
  });
})();
