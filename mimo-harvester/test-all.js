#!/usr/bin/env node
/**
 * mimo-harvester Full Test Script
 * Tests all platforms with accounts from accounts.txt
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const ACCOUNT_FILE = resolve(ROOT, 'accounts.txt');
const OUTPUT_DIR = resolve(ROOT, 'output');
const LOG_FILE = resolve(OUTPUT_DIR, 'test-results.log');

// Ensure output dirs
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
if (!existsSync(resolve(OUTPUT_DIR, 'keys'))) mkdirSync(resolve(OUTPUT_DIR, 'keys'), { recursive: true });
if (!existsSync(resolve(OUTPUT_DIR, 'errors'))) mkdirSync(resolve(OUTPUT_DIR, 'errors'), { recursive: true });

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
}

function loadAccounts() {
  if (!existsSync(ACCOUNT_FILE)) return [];
  return readFileSync(ACCOUNT_FILE, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(line => {
      const [email, password, proxy] = line.split('|');
      return { email, password, proxy };
    });
}

// Set Chrome path
process.env.CHROME_EXECUTABLE_PATH = '/home/work/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome';
process.env.PW_HEADLESS = '1';

async function testPlatform(platformName, accounts, maxTest = 2) {
  log(`\n${'='.repeat(60)}`);
  log(`Testing: ${platformName.toUpperCase()} (${Math.min(accounts.length, maxTest)} accounts)`);
  log(`${'='.repeat(60)}`);

  const results = { success: 0, failed: 0, errors: [] };
  const testAccounts = accounts.slice(0, maxTest);

  try {
    // Dynamic import of the worker
    let WorkerClass;
    switch (platformName) {
      case 'ollama':
        WorkerClass = (await import('./src/automations/ollama/OllamaWorker.js')).default;
        break;
      case 'qoder':
        WorkerClass = (await import('./src/automations/qoder/QoderWorker.js')).default;
        break;
      case 'novabox':
        WorkerClass = (await import('./src/automations/novabox/NovaboxWorker.js')).default;
        break;
      case 'codebuddy':
        WorkerClass = (await import('./src/automations/codebuddy/CodebuddyWorker.js')).default;
        break;
      case 'ibmbob':
        WorkerClass = (await import('./src/automations/ibmbob/IbmBobWorker.js')).default;
        break;
      case 'tokenharbor':
        WorkerClass = (await import('./src/automations/tokenharbor/TokenHarborWorker.js')).default;
        break;
      default:
        log(`Unknown platform: ${platformName}`);
        return results;
    }

    const worker = new WorkerClass();

    for (let i = 0; i < testAccounts.length; i++) {
      const account = testAccounts[i];
      log(`\n[${i + 1}/${testAccounts.length}] Testing ${account.email}...`);

      try {
        // Import browser module
        const { launchBrowser, createContext } = await import('./src/browser/index.js');
        
        // Launch browser
        log(`  Launching browser...`);
        const browser = await launchBrowser(account.proxy || '');
        const page = await createContext(browser);
        page.setDefaultTimeout(30000);

        try {
          const result = await worker.executeForAccount(account, page, (msg) => log(`  ${msg}`));
          
          if (result.success) {
            results.success++;
            log(`  ✅ SUCCESS: ${result.key}`);
            // Save key
            appendFileSync(resolve(OUTPUT_DIR, 'keys', `${platformName}_keys.txt`), `${result.key}\n`);
          } else {
            results.failed++;
            results.errors.push({ email: account.email, error: result.error });
            log(`  ❌ FAILED: ${result.error}`);
          }
        } finally {
          try { await browser.close(); } catch {}
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ email: account.email, error: err.message });
        log(`  ❌ ERROR: ${err.message}`);
      }

      // Delay between accounts
      if (i < testAccounts.length - 1) {
        log(`  Waiting 5s before next account...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  } catch (err) {
    log(`  ❌ Platform init error: ${err.message}`);
  }

  log(`\n${platformName.toUpperCase()} Results: ${results.success} success, ${results.failed} failed`);
  return results;
}

async function main() {
  log('🚀 mimo-harvester Full Test Starting...');
  log(`Chrome: ${process.env.CHROME_EXECUTABLE_PATH}`);
  
  const accounts = loadAccounts();
  log(`Loaded ${accounts.length} accounts`);
  
  if (accounts.length === 0) {
    log('No accounts found! Add accounts to accounts.txt');
    process.exit(1);
  }

  const allResults = {};

  // Test each platform (2 accounts each to avoid wasting all)
  const platforms = ['ollama', 'qoder', 'novabox', 'codebuddy', 'ibmbob', 'tokenharbor'];
  
  for (const platform of platforms) {
    try {
      allResults[platform] = await testPlatform(platform, accounts, 2);
    } catch (err) {
      log(`\n❌ ${platform} crashed: ${err.message}`);
      allResults[platform] = { success: 0, failed: 0, errors: [{ error: err.message }] };
    }
  }

  // Final report
  log('\n' + '='.repeat(60));
  log('📊 FINAL REPORT');
  log('='.repeat(60));
  
  for (const [platform, results] of Object.entries(allResults)) {
    const status = results.success > 0 ? '✅' : '❌';
    log(`${status} ${platform.padEnd(12)} — ${results.success} success, ${results.failed} failed`);
    if (results.errors.length > 0) {
      for (const err of results.errors) {
        log(`   └─ ${err.email || 'init'}: ${err.error}`);
      }
    }
  }

  log('\n✅ Test complete! Results saved to output/test-results.log');
}

main().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
