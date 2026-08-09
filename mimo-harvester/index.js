#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import config from './src/config/index.js';
import { ensureOutputDirs, loadAccounts } from './src/utils/index.js';
import { printReport } from './src/cli/reporter.js';
import runCodebuddy from './src/automations/codebuddy/index.js';
import runQoder from './src/automations/qoder/index.js';
import runOllama from './src/automations/ollama/index.js';
import runNovabox from './src/automations/novabox/index.js';
import runIbmBob from './src/automations/ibmbob/index.js';

// ─── Banner ──────────────────────────────────────────────
function printBanner() {
  console.log(chalk.cyan(`
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║   ███╗   ███╗ ██╗ ███╗   ███╗  ██████╗                  ║
  ║   ████╗ ████║ ██║ ████╗ ████║ ██╔═══██╗                 ║
  ║   ██╔████╔██║ ██║ ██╔████╔██║ ██║   ██║                 ║
  ║   ██║╚██╔╝██║ ██║ ██║╚██╔╝██║ ██║   ██║                 ║
  ║   ██║ ╚═╝ ██║ ██║ ██║ ╚═╝ ██║ ╚██████╔╝                 ║
  ║   ╚═╝     ╚═╝ ╚═╝ ╚═╝     ╚═╝  ╚═════╝                 ║
  ║                                                          ║
  ║   ██╗  ██╗  █████╗  ██████╗ ██╗   ██╗ ███████╗ ███████╗ ║
  ║   ██║  ██║ ██╔══██╗ ██╔══██╗██║   ██║ ██╔════╝ ██╔════╝ ║
  ║   ███████║ ███████║ ██████╔╝██║   ██║ █████╗   ███████╗ ║
  ║   ██╔══██║ ██╔══██║ ██╔══██╗██║   ██║ ██╔══╝   ╚════██║ ║
  ║   ██║  ██║ ██║  ██║ ██║  ██║╚██████╔╝ ███████╗ ███████║ ║
  ║   ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═════╝  ╚══════╝ ╚══════╝ ║
  ║                                                          ║
  ║   Token Harvester v1.0                                   ║
  ╚══════════════════════════════════════════════════════════╝
  `));
}

// ─── Initialize ──────────────────────────────────────────
import { readFileSync } from 'fs';

function initialize() {
  ensureOutputDirs();

  // Create .env if not exists
  if (!existsSync(resolve(config.ROOT, '.env'))) {
    const envExample = resolve(config.ROOT, '.env.example');
    if (existsSync(envExample)) {
      writeFileSync(resolve(config.ROOT, '.env'), readFileSync(envExample));
    }
  }

  // Create accounts.txt if not exists
  if (!existsSync(config.ACCOUNT_FILE)) {
    writeFileSync(config.ACCOUNT_FILE, '# email|password|proxy\n');
  }

  // Create proxies.txt if not exists
  if (!existsSync(config.PROXY_POOL_FILE)) {
    writeFileSync(config.PROXY_POOL_FILE, '# ip:port:user:pass\n');
  }
}

// ─── Platform runners map ────────────────────────────────
const platformRunners = {
  codebuddy: runCodebuddy,
  qoder: runQoder,
  ollama: runOllama,
  novabox: runNovabox,
  ibmbob: runIbmBob,
};

// ─── Main Menu ───────────────────────────────────────────
async function mainMenu() {
  printBanner();

  initialize();

  const accounts = loadAccounts();
  console.log(chalk.gray(`  📂 Accounts loaded: ${accounts.length}`));
  console.log(chalk.gray(`  🖥️  Browser headless: ${config.PW_HEADLESS}`));
  console.log(chalk.gray(`  ⚡ Browser count: ${config.BROWSER_COUNT}`));
  console.log('');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What do you want to do?',
      choices: [
        { name: '🎯 Harvest All Platforms', value: 'all' },
        { name: '🔧 Harvest Single Platform', value: 'single' },
        { name: '📊 View Last Report', value: 'report' },
        { name: '⚙️  Settings', value: 'settings' },
        { name: '❌ Exit', value: 'exit' },
      ],
    },
  ]);

  switch (action) {
    case 'all':
      await harvestAll();
      break;
    case 'single':
      await harvestSingle();
      break;
    case 'report':
      await viewReport();
      break;
    case 'settings':
      await showSettings();
      break;
    case 'exit':
      console.log(chalk.yellow('\n  Goodbye! 👋\n'));
      process.exit(0);
  }

  // Return to menu
  const { again } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'again',
      message: 'Return to main menu?',
      default: true,
    },
  ]);

  if (again) await mainMenu();
}

// ─── Harvest All ─────────────────────────────────────────
async function harvestAll() {
  const { parallel, useProxy } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'parallel',
      message: 'Run platforms in parallel?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'useProxy',
      message: 'Use proxy pool?',
      default: false,
    },
  ]);

  const log = (msg) => console.log(msg);
  const results = {};

  const platforms = ['codebuddy', 'qoder', 'ollama', 'novabox', 'ibmbob'];

  if (parallel) {
    const allPromises = platforms.map(async (platform) => {
      try {
        results[platform] = await platformRunners[platform]({ parallel: false, useProxy, log });
      } catch (err) {
        results[platform] = { success: 0, failed: 0, errors: [{ error: err.message }] };
      }
    });
    await Promise.all(allPromises);
  } else {
    for (const platform of platforms) {
      console.log(chalk.bold(`\n${'─'.repeat(50)}`));
      try {
        results[platform] = await platformRunners[platform]({ parallel: false, useProxy, log });
      } catch (err) {
        console.error(chalk.red(`  Error in ${platform}: ${err.message}`));
        results[platform] = { success: 0, failed: 0, errors: [{ error: err.message }] };
      }
    }
  }

  printReport(results);
}

// ─── Harvest Single ──────────────────────────────────────
async function harvestSingle() {
  const { platform, parallel, useProxy } = await inquirer.prompt([
    {
      type: 'list',
      name: 'platform',
      message: 'Select platform:',
      choices: [
        { name: '🟢 CodeBuddy (GitHub OAuth)', value: 'codebuddy' },
        { name: '🔵 Qoder (Google OAuth + 800 calls)', value: 'qoder' },
        { name: '🟠 Ollama Cloud (Google OAuth + API key)', value: 'ollama' },
        { name: '🟣 Novabox / Blackbox.ai (Temp email + API key)', value: 'novabox' },
        { name: '🔴 IBM Bob (Google OAuth)', value: 'ibmbob' },
      ],
    },
    {
      type: 'confirm',
      name: 'parallel',
      message: 'Run with parallel workers?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'useProxy',
      message: 'Use proxy pool?',
      default: false,
    },
  ]);

  const log = (msg) => console.log(msg);

  console.log(chalk.bold(`\n${'─'.repeat(50)}`));

  try {
    const result = await platformRunners[platform]({ parallel, useProxy, log });
    printReport({ [platform]: result });
  } catch (err) {
    console.error(chalk.red(`\n  Error: ${err.message}`));
  }
}

// ─── View Report ─────────────────────────────────────────
async function viewReport() {
  const platforms = ['codebuddy', 'qoder', 'ollama', 'novabox', 'ibmbob'];
  const results = {};

  for (const p of platforms) {
    const keyFile = resolve(config.KEYS_DIR, `${p}_keys.txt`);
    if (existsSync(keyFile)) {
      const lines = readFileSync(keyFile, 'utf-8').split('\n').filter(Boolean);
      results[p] = { success: lines.length, failed: 0 };
    }
  }

  if (Object.keys(results).length === 0) {
    console.log(chalk.yellow('\n  No harvest results found yet.\n'));
    return;
  }

  printReport(results);
}

// ─── Settings ────────────────────────────────────────────
async function showSettings() {
  console.log(chalk.bold('\n  ⚙️  Current Settings:\n'));
  console.log(`  Chrome Path:        ${config.CHROME_EXECUTABLE_PATH || '(auto-detect)'}`);
  console.log(`  Browser Count:      ${config.BROWSER_COUNT}`);
  console.log(`  Browser SlowMo:     ${config.BROWSER_SLOW_MO}ms`);
  console.log(`  Headless:           ${config.PW_HEADLESS ? 'Yes' : 'No'}`);
  console.log(`  Account File:       ${config.ACCOUNT_FILE}`);
  console.log(`  Proxy File:         ${config.PROXY_POOL_FILE}`);
  console.log(`  Email Provider:     ${config.TEMP_EMAIL_PROVIDER}`);
  console.log(`  Delay (accounts):   ${config.DELAY_BETWEEN_ACCOUNTS_MS}ms`);
  console.log(`  Output Dir:         ${config.OUTPUT_DIR}`);
  console.log(chalk.gray('\n  Edit .env to change settings.\n'));
}

// ─── Run ─────────────────────────────────────────────────
mainMenu().catch((err) => {
  console.error(chalk.red(`\nFatal error: ${err.message}`));
  process.exit(1);
});
