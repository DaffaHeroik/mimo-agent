import BaseWorker from '../base/BaseWorker.js';
import { sleep, randomSleep } from '../../utils/index.js';
import { googleLogin } from '../../providers/google/login.js';

const OLLAMA_SIGNIN = 'https://ollama.com/signin';
const OLLAMA_KEYS = 'https://ollama.com/settings/keys';

export default class OllamaWorker extends BaseWorker {
  get platformName() {
    return 'ollama';
  }

  async executeForAccount(account, page, log) {
    const { email, password } = account;

    // Step 1: Navigate to Ollama sign-in
    log(`  Navigating to Ollama sign-in...`);
    await page.goto(OLLAMA_SIGNIN, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    // Step 2: Click "Continue with Google"
    log(`  Clicking Continue with Google...`);
    const googleLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const google = links.find(l => l.textContent.toLowerCase().includes('google'));
      return google ? google.href : null;
    });

    if (!googleLink) {
      throw new Error('Google login link not found on Ollama sign-in page');
    }

    // Navigate to Google OAuth
    await page.goto(googleLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    // Step 3: Google OAuth
    log(`  Completing Google OAuth...`);
    const currentUrl = page.url();
    
    if (currentUrl.includes('accounts.google.com') || currentUrl.includes('google.com/signin')) {
      try {
        await googleLogin(page, email, password);
        log(`  ✅ Google login successful!`);
      } catch (e) {
        throw new Error(`Google login failed: ${e.message}`);
      }
    }

    // Step 4: Wait for redirect back to Ollama
    log(`  Waiting for redirect to Ollama...`);
    
    // Wait for navigation to complete
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch {
      // Navigation might have already happened
    }

    // Wait for Ollama domain
    let onOllama = false;
    for (let i = 0; i < 15; i++) {
      await sleep(2000);
      const url = page.url();
      
      if (url.includes('ollama.com') && !url.includes('signin') && !url.includes('google') && !url.includes('accounts.google')) {
        log(`  ✅ On Ollama: ${url.substring(0, 50)}`);
        onOllama = true;
        break;
      }
      
      // Handle consent buttons
      try {
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          for (const btn of btns) {
            const text = btn.textContent.toLowerCase().trim();
            if (text.includes('continue') || text.includes('allow') || text.includes('accept') || text.includes('lanjutkan')) {
              btn.click();
            }
          }
        });
      } catch {
        // Context may have been destroyed due to navigation, that's OK
      }
    }

    if (!onOllama) {
      const finalUrl = page.url();
      throw new Error(`Did not redirect to Ollama. Current URL: ${finalUrl}`);
    }

    await sleep(3000);

    // Step 5: Navigate to API keys page
    log(`  Navigating to API keys...`);
    await page.goto(OLLAMA_KEYS, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    // Check if we're on the keys page
    const keysUrl = page.url();
    if (keysUrl.includes('signin') || keysUrl.includes('login')) {
      throw new Error('Not logged in — redirected to sign-in page');
    }

    // Step 6: Generate API key
    log(`  Generating API key...`);
    const apiKey = await this.generateApiKey(page, log);

    if (!apiKey) {
      throw new Error('Failed to generate API key');
    }

    log(`  ✅ API key: ${apiKey.substring(0, 15)}...`);

    return {
      success: true,
      key: `${email}|${apiKey}`,
    };
  }

  async generateApiKey(page, log) {
    // Click "Add API Key" button
    const createBtnClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const btn = btns.find(b => {
        const text = b.textContent.toLowerCase();
        return text.includes('add api key') || text.includes('create') || text.includes('generate') || text.includes('new key');
      });
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }).catch(() => false);

    if (!createBtnClicked) {
      log(`  No create button found, checking for existing key...`);
      return await this.extractExistingKey(page);
    }

    await sleep(2000);

    // Fill name field if present
    await page.evaluate(() => {
      const nameInput = document.querySelector('input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]');
      if (nameInput) {
        nameInput.value = `mimo-${Date.now()}`;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }).catch(() => {});

    await sleep(1000);

    // Submit - click "Generate API Key"
    const submitClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => {
        const text = b.textContent.toLowerCase().trim();
        return text.includes('generate api key') || text.includes('create') || text.includes('generate') || text.includes('save');
      });
      if (btn) {
        btn.click();
        return btn.textContent.trim();
      }
      return null;
    }).catch(() => null);

    await sleep(3000);

    // Extract the key
    const key = await this.extractKeyFromPage(page);
    if (key) return key;

    // Intercept API response
    return await this.interceptApiKeyGeneration(page);
  }

  async extractExistingKey(page) {
    return await page.evaluate(() => {
      const els = document.querySelectorAll('code, pre, .api-key, [data-key], input[readonly]');
      for (const el of els) {
        const text = (el.value || el.textContent || '').trim();
        if (text.length > 20 && (text.startsWith('oll-') || text.startsWith('sk-') || /^[a-f0-9]{32}$/.test(text))) {
          return text;
        }
      }
      // Also check for hex keys in page text
      const match = document.body.textContent.match(/([a-f0-9]{32})/);
      if (match) return match[1];
      return '';
    }).catch(() => '');
  }

  async extractKeyFromPage(page) {
    return await page.evaluate(() => {
      // Look for key in code blocks
      const els = document.querySelectorAll('code, pre, .api-key, [data-key], input[readonly]');
      for (const el of els) {
        const text = (el.value || el.textContent || '').trim();
        if (text.length > 20 && (text.startsWith('oll-') || text.startsWith('sk-'))) {
          return text;
        }
      }
      // Try modal
      const modal = document.querySelector('.modal, [role="dialog"]');
      if (modal) {
        const match = modal.textContent.match(/(oll-[a-zA-Z0-9_-]{20,}|sk-[a-zA-Z0-9_-]{20,}|[a-f0-9]{32})/);
        if (match) return match[1];
      }
      // Try body - look for key near "Added" text or in key display area
      const bodyText = document.body.textContent;
      // Match hex keys (32 chars)
      const hexMatch = bodyText.match(/([a-f0-9]{32})/);
      if (hexMatch) return hexMatch[1];
      // Match oll- prefixed keys
      const ollMatch = bodyText.match(/(oll-[a-zA-Z0-9_-]{20,})/);
      if (ollMatch) return ollMatch[1];
      return '';
    }).catch(() => '');
  }

  async interceptApiKeyGeneration(page) {
    return new Promise((resolve) => {
      let key = '';
      const handler = async (response) => {
        try {
          const url = response.url();
          if (url.includes('key') || url.includes('api-key') || url.includes('token')) {
            if (response.status() >= 200 && response.status() < 300) {
              const body = await response.json().catch(() => null);
              if (body) {
                const possibleKey = body.key || body.api_key || body.token || body.secret || '';
                if (possibleKey.length > 15) key = possibleKey;
              }
            }
          }
        } catch {}
      };

      page.on('response', handler);
      setTimeout(() => {
        try { page.off('response', handler); } catch {}
        resolve(key);
      }, 10000);
    });
  }
}
