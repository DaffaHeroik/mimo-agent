import QoderWorker from './QoderWorker.js';
import { loadAccounts, chunkAccounts, sleep } from '../../utils/index.js';
import config from '../../config/index.js';
import { createProgressBar } from '../../cli/progress.js';

export async function runQoder(options = {}) {
  const { parallel = false, useProxy = false, log = console.log } = options;

  const accounts = loadAccounts().filter((a) => a.email && a.password);
  if (accounts.length === 0) {
    log('No accounts found. Add accounts to accounts.txt');
    return { success: 0, failed: 0 };
  }

  log(`\n🚀 Qoder Harvester — ${accounts.length} accounts\n`);

  if (parallel && accounts.length > 1) {
    return await runParallel(accounts, useProxy, log);
  }
  return await runSequential(accounts, useProxy, log);
}

async function runSequential(accounts, useProxy, log) {
  const worker = new QoderWorker();
  const results = { success: 0, failed: 0 };
  const progress = createProgressBar('Qoder', accounts.length);

  for (let i = 0; i < accounts.length; i++) {
    const result = await worker.processAccount(
      accounts[i], 0, 0,
      log,
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
  const progress = createProgressBar('Qoder', accounts.length);
  let completed = 0;

  const workers = chunks.map(async (chunk, wi) => {
    const worker = new QoderWorker();
    for (const account of chunk) {
      const result = await worker.processAccount(
        account, wi, wi,
        log,
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

export { QoderWorker };
export default runQoder;
