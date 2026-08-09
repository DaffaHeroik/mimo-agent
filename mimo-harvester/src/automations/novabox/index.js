import NovaboxWorker from './NovaboxWorker.js';
import { loadAccounts, chunkAccounts, sleep } from '../../utils/index.js';
import config from '../../config/index.js';
import { createProgressBar } from '../../cli/progress.js';

export async function runNovabox(options = {}) {
  const { parallel = false, useProxy = false, log = console.log } = options;

  // Novabox can run with or without pre-existing accounts
  // If no accounts, it will create new ones using temp email
  let accounts = loadAccounts().filter((a) => a.email && a.password);
  if (accounts.length === 0) {
    // Create a single dummy account entry for temp-email-based registration
    accounts = [{ email: 'auto', password: 'auto', proxy: '' }];
  }

  log(`\n🚀 Novabox (Blackbox.ai) Harvester — ${accounts.length} account(s)\n`);

  if (parallel && accounts.length > 1) {
    return await runParallel(accounts, useProxy, log);
  }
  return await runSequential(accounts, useProxy, log);
}

async function runSequential(accounts, useProxy, log) {
  const worker = new NovaboxWorker();
  const results = { success: 0, failed: 0 };
  const progress = createProgressBar('Novabox', accounts.length);

  for (let i = 0; i < accounts.length; i++) {
    const result = await worker.processAccount(
      accounts[i], 0, 0, log,
      (status) => progress.updateProgress(i, status),
      useProxy
    );
    if (result.success) results.success++;
    else results.failed++;
    progress.updateProgress(i + 1, result.success ? '✓' : '✗');
    if (i < accounts.length - 1) await sleep(config.DELAY_BETWEEN_ACCOUNTS_MS);
  }

  progress.stop();
  return results;
}

async function runParallel(accounts, useProxy, log) {
  const browserCount = config.BROWSER_COUNT;
  const chunks = chunkAccounts(accounts, browserCount);
  const results = { success: 0, failed: 0 };
  const progress = createProgressBar('Novabox', accounts.length);
  let completed = 0;

  const workers = chunks.map(async (chunk, wi) => {
    const worker = new NovaboxWorker();
    for (const account of chunk) {
      const result = await worker.processAccount(
        account, wi, wi, log,
        (status) => progress.updateProgress(completed, `[W${wi}] ${status}`),
        useProxy
      );
      if (result.success) results.success++;
      else results.failed++;
      completed++;
      progress.updateProgress(completed);
      await sleep(config.DELAY_BETWEEN_ACCOUNTS_MS);
    }
  });

  await Promise.all(workers);
  progress.stop();
  return results;
}

export { NovaboxWorker };
export default runNovabox;
