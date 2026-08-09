import BaseWorker from '../base/BaseWorker.js';
import { sleep, randomSleep } from '../../utils/index.js';
import { googleLogin } from '../../providers/google/login.js';

const BLACKBOX_APP = 'https://app.blackbox.ai';

export default class NovaboxWorker extends BaseWorker {
  get platformName() { return 'novabox'; }

  async executeForAccount(account, page, log) {
    const { email, password } = account;

    // Step 1: Navigate to Blackbox.ai login page
    log(`  Navigating to Blackbox.ai login...`);
    await page.goto(`${BLACKBOX_APP}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);

    // Step 2: Click Google button
    log(`  Looking for Google login button...`);
    const googleBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => (b.textContent || '').trim() === 'Google') || null;
    });

    if (googleBtn && googleBtn.asElement()) {
      log(`  Found Google button, clicking...`);
      await googleBtn.click();
      await sleep(3000);
    } else {
      throw new Error('Google button not found on Blackbox.ai login page');
    }

    // Step 3: Google OAuth login
    log(`  Completing Google OAuth...`);
    try {
      await page.waitForSelector('input[type="email"], #identifierId', { timeout: 15000 });
    } catch {}
    const isGoogleLogin = await page.$('input[type="email"], #identifierId');
    if (isGoogleLogin) {
      await googleLogin(page, email, password);
    }

    // Handle consent screens
    for (let i = 0; i < 5; i++) {
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => {
          const t = (b.textContent || '').toLowerCase();
          return t.includes('continue') || t.includes('allow') || t.includes('accept');
        });
        if (btn) { btn.click(); return btn.textContent.trim(); }
        return null;
      });
      if (clicked) await sleep(2000);
      else break;
    }

    await sleep(5000);

    // Step 4: Check if logged in
    const finalUrl = page.url();
    log(`  Final URL: ${finalUrl}`);

    if (finalUrl.includes('blackbox.ai') && !finalUrl.includes('accounts.google.com')) {
      log(`  ✅ Blackbox.ai login successful!`);

      // Step 5: Get API key via browser context (use page.evaluate for fetch)
      log(`  Getting API key via browser context...`);
      const apiKey = await this.getApiKeyViaBrowser(page, log);

      if (apiKey) {
        log(`  API key: ${apiKey.substring(0, 15)}...`);
        return { success: true, key: `${email}|${apiKey}` };
      }

      throw new Error('Could not get API key from Blackbox.ai');
    }

    throw new Error(`Blackbox.ai: Login failed. URL: ${finalUrl.substring(0, 100)}`);
  }

  async getApiKeyViaBrowser(page, log) {
    // Use page.evaluate to make fetch requests from the browser context
    // This automatically includes cookies/session
    try {
      const result = await page.evaluate(async () => {
        try {
          // Try to get existing keys
          const keysRes = await fetch('/api/keys', { credentials: 'include' });
          if (keysRes.ok) {
            const keysData = await keysRes.json();
            if (keysData.keys && keysData.keys.length > 0) {
              return keysData.keys[0].key || keysData.keys[0].api_key || keysData.keys[0].value || '';
            }
          }
          
          // Try alternative endpoints
          const altRes = await fetch('/api/user/keys', { credentials: 'include' });
          if (altRes.ok) {
            const altData = await altRes.json();
            if (altData.keys && altData.keys.length > 0) {
              return altData.keys[0].key || altData.keys[0].api_key || altData.keys[0].value || '';
            }
          }

          // Try creating a new key
          const createRes = await fetch('/api/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: `key-${Date.now()}` }),
          });
          if (createRes.ok) {
            const createData = await createRes.json();
            return createData.key || createData.api_key || createData.value || '';
          }

          return '';
        } catch (e) {
          return `error: ${e.message}`;
        }
      });

      if (result && !result.startsWith('error:') && result.length > 10) {
        return result;
      }
      log(`  Browser fetch result: ${result || 'empty'}`);

      // Fallback: Navigate to API keys page and scrape
      log(`  Trying to scrape API keys page...`);
      for (const path of ['/api-keys', '/settings/api-keys', '/settings', '/dashboard']) {
        await page.goto(`${BLACKBOX_APP}${path}`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await sleep(2000);

        const key = await page.evaluate(() => {
          // Look for any text that looks like an API key
          const allText = document.body.innerText;
          const matches = allText.match(/sk-[a-zA-Z0-9]{20,}/g) || [];
          if (matches.length > 0) return matches[0];
          
          // Look in code/pre elements
          const els = document.querySelectorAll('code, pre, .key, input[readonly], [data-key]');
          for (const el of els) {
            const text = (el.textContent || el.value || '').trim();
            if (text.length > 20 && text.match(/^[a-zA-Z0-9_\-]{20,}$/)) return text;
          }
          return '';
        });
        if (key) return key;
      }

    } catch (err) {
      log(`  Error: ${err.message}`);
    }
    return '';
  }
}
