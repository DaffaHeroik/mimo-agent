import BaseWorker from '../base/BaseWorker.js';
import { sleep, randomSleep } from '../../utils/index.js';
import { googleLogin } from '../../providers/google/login.js';

const HARBOR_BASE = 'https://tokenharbor.ai';
const HARBOR_INVITE = 'TH-653T-4B6A';

export default class TokenHarborWorker extends BaseWorker {
  get platformName() { return 'tokenharbor'; }

  async executeForAccount(account, page, log) {
    const { email, password } = account;

    // Step 1: Navigate to TokenHarbor with invite code
    log(`  Navigating to TokenHarbor...`);
    await page.goto(`${HARBOR_BASE}/login?invite=${HARBOR_INVITE}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);

    // Step 2: Click Google OAuth button
    log(`  Looking for Google OAuth button...`);
    const googleBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.querySelector('svg path[fill="#EA4335"]') || b.innerHTML.includes('EA4335')) || null;
    });

    if (googleBtn && googleBtn.asElement()) {
      log(`  Found Google button, clicking...`);
      await googleBtn.click();
      await sleep(3000);
    } else {
      throw new Error('Google OAuth button not found on TokenHarbor');
    }

    // Step 3: Google OAuth login
    log(`  Completing Google OAuth...`);
    try { await page.waitForSelector('input[type="email"], #identifierId', { timeout: 15000 }); } catch {}
    if (await page.$('input[type="email"], #identifierId')) {
      await googleLogin(page, email, password);
    }

    // Handle consent
    for (let i = 0; i < 5; i++) {
      const clicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => {
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
    const finalUrl = page.url();
    log(`  Final URL: ${finalUrl}`);

    if (!finalUrl.includes('tokenharbor.ai')) {
      throw new Error(`TokenHarbor: Not redirected back. URL: ${finalUrl.substring(0, 100)}`);
    }

    // Step 4: Navigate to dashboard
    log(`  Navigating to dashboard...`);
    await page.goto(`${HARBOR_BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(3000);

    // Step 5: Claim $5 gift
    log(`  Claiming $5 gift...`);
    await this.claimGift(page, log);

    // Step 6: Create API key
    log(`  Creating API key...`);
    const apiKey = await this.createApiKey(page, log);

    if (apiKey) {
      log(`  ✅ API key: ${apiKey.substring(0, 15)}...`);
      return { success: true, key: `${email}|${apiKey}` };
    }

    throw new Error('TokenHarbor: Could not create API key');
  }

  async claimGift(page, log) {
    // Click "X new gift to claim" button
    const giftClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('gift') && t.includes('claim');
      });
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    });

    if (giftClicked) {
      log(`  Opened gift panel: ${giftClicked}`);
      await sleep(2000);

      // Click "Claim" button
      const claimed = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => (b.textContent || '').trim() === 'Claim');
        if (btn) { btn.click(); return true; }
        return false;
      });

      if (claimed) {
        log(`  Claim button clicked`);
        await sleep(3000);
      }
    } else {
      log(`  No gift to claim`);
    }
  }

  async createApiKey(page, log) {
    // Navigate to API keys page
    await page.goto(`${HARBOR_BASE}/dashboard/api-keys`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    // Click "+ New key" button
    const newKeyClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('new key');
      });
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (!newKeyClicked) {
      log(`  "+ New key" button not found`);
      return '';
    }

    log(`  Clicked "+ New key"`);
    await sleep(2000);

    // Fill label input
    const labelInput = await page.$('input[placeholder*="Cursor"], input[placeholder*="Production"], input[placeholder*="project"], input[type="text"]');
    if (labelInput) {
      await labelInput.click({ clickCount: 3 });
      await labelInput.type(`mimo-key-${Date.now()}`, { delay: 20 });
      await sleep(500);
    }

    // Click "Create key" button
    const createClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('create key');
      });
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (createClicked) {
      log(`  Clicked "Create key"`);
      await sleep(3000);

      // Extract the API key - it should appear in a code/pre element or input
      const apiKey = await page.evaluate(() => {
        // Look for the key in various elements
        const els = document.querySelectorAll('code, pre, .key, input[readonly], [data-key], .api-key, span[class*="key"]');
        for (const el of els) {
          const text = (el.textContent || el.value || '').trim();
          if (text.length > 20 && text.match(/^[a-zA-Z0-9_\-]{20,}$/)) return text;
        }

        // Also check for any new text that looks like a key
        const allText = document.body.innerText;
        const matches = allText.match(/sk-[a-zA-Z0-9]{20,}/g) || [];
        if (matches.length > 0) return matches[0];

        // Check for th- prefix (TokenHarbor keys)
        const thMatches = allText.match(/th-[a-zA-Z0-9]{20,}/g) || [];
        if (thMatches.length > 0) return thMatches[0];

        // Check for any 32+ char hex string
        const hexMatches = allText.match(/[a-f0-9]{32,}/g) || [];
        if (hexMatches.length > 0) return hexMatches[0];

        return '';
      });

      if (apiKey) return apiKey;

      // Try to find key in any input field
      const keyFromInput = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          const val = (inp.value || '').trim();
          if (val.length > 20) return val;
        }
        return '';
      });
      if (keyFromInput) return keyFromInput;
    }

    return '';
  }
}
