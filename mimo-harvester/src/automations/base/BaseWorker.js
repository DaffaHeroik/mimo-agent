import { launchBrowser, createContext } from '../../browser/index.js';
import {
  sleep,
  appendKey,
  appendErrorAccount,
  removeAccountFromFile,
  tryAcquireAccountLock,
  releaseAccountLock,
  acquireProxy,
  releaseProxy,
  loadProxyPool,
} from '../../utils/index.js';
import config from '../../config/index.js';

/**
 * Abstract base class for all automation workers.
 * Subclasses must implement:
 *   - get platformName() → string
 *   - executeForAccount(account, page, log) → { success, key, error }
 */
export default class BaseWorker {
  get platformName() {
    throw new Error('platformName must be implemented');
  }

  /**
   * Process a single account through the full automation flow.
   */
  async processAccount(account, browserArgsIndex = 0, workerIndex = 0, log = console.log, updateProgress = () => {}, useProxy = false) {
    const { email, password, proxy: accountProxy } = account;

    // Try to acquire lock
    if (!tryAcquireAccountLock(email)) {
      log(`[W${workerIndex}] ${email} — locked, skipping`);
      return { success: false, error: 'Account locked' };
    }

    let browser = null;
    let page = null;
    let proxyUsed = '';

    try {
      // Determine proxy
      let proxy = '';
      if (useProxy) {
        if (accountProxy) {
          proxy = accountProxy;
        } else {
          const pool = loadProxyPool();
          proxy = acquireProxy(pool) || '';
        }
      }
      proxyUsed = proxy;

      // Launch browser (Puppeteer + stealth)
      updateProgress(`Launching browser${proxy ? ' (proxy)' : ''}...`);
      browser = await launchBrowser(proxy);
      page = await createContext(browser);
      page.setDefaultTimeout(30000);

      // Run the automation
      updateProgress('Executing automation...');
      const result = await this.executeForAccount(account, page, log);

      if (result.success) {
        appendKey(this.platformName, result.key);
        removeAccountFromFile(email);
        log(`[W${workerIndex}] ✅ ${email} — ${this.platformName} success`);
        updateProgress('✅ Done');
        return { success: true, key: result.key };
      } else {
        appendErrorAccount(email, password, this.platformName, result.error);
        log(`[W${workerIndex}] ❌ ${email} — ${result.error}`);
        updateProgress(`❌ ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (err) {
      const errMsg = err.message || String(err);
      appendErrorAccount(email, password, this.platformName, errMsg);
      log(`[W${workerIndex}] ❌ ${email} — ${errMsg}`);
      updateProgress(`❌ Error`);
      return { success: false, error: errMsg };
    } finally {
      releaseAccountLock(email);
      if (proxyUsed) releaseProxy(proxyUsed);
      try {
        if (browser) await browser.close();
      } catch {
        // ignore close errors
      }
    }
  }

  /**
   * Process multiple accounts sequentially.
   */
  async processAccounts(accounts, log = console.log, updateProgress = () => {}, useProxy = false) {
    const results = { success: 0, failed: 0, errors: [] };

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      log(`\n[${i + 1}/${accounts.length}] Processing ${account.email}...`);
      updateProgress(`Account ${i + 1}/${accounts.length}`);

      const result = await this.processAccount(account, 0, 0, log, updateProgress, useProxy);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({ email: account.email, error: result.error });
      }

      // Delay between accounts
      if (i < accounts.length - 1) {
        const delay = config.DELAY_BETWEEN_ACCOUNTS_MS;
        log(`  Waiting ${delay}ms before next account...`);
        await sleep(delay);
      }
    }

    return results;
  }

  /**
   * Must be implemented by subclass.
   */
  async executeForAccount(account, page, log) {
    throw new Error('executeForAccount must be implemented');
  }
}
