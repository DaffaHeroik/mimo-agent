import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import config from '../config/index.js';

// ─── Timing helpers ──────────────────────────────────────

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function randomSleep(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return sleep(ms);
}

// ─── Account management ──────────────────────────────────

/**
 * Load accounts from the configured account file.
 * Format: email|password|proxy (one per line, # for comments)
 */
export function loadAccounts() {
  if (!existsSync(config.ACCOUNT_FILE)) return [];

  const lines = readFileSync(config.ACCOUNT_FILE, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  return lines.map((line) => {
    const parts = line.split('|');
    return {
      email: parts[0] || '',
      password: parts[1] || '',
      proxy: parts[2] || '',
    };
  });
}

/**
 * Split accounts into chunks for parallel processing.
 */
export function chunkAccounts(accounts, chunkCount) {
  const chunks = [];
  const size = Math.ceil(accounts.length / chunkCount);
  for (let i = 0; i < accounts.length; i += size) {
    chunks.push(accounts.slice(i, i + size));
  }
  return chunks;
}

// ─── Account locking ─────────────────────────────────────

const accountLocks = new Map();

export function tryAcquireAccountLock(email) {
  if (accountLocks.get(email)) return false;
  accountLocks.set(email, true);
  return true;
}

export function releaseAccountLock(email) {
  accountLocks.delete(email);
}

// ─── Key / error persistence ─────────────────────────────

export function appendKey(platformName, key) {
  ensureOutputDirs();
  const keyFile = resolve(config.KEYS_DIR, `${platformName}_keys.txt`);
  appendFileSync(keyFile, `${key}\n`);
}

export function appendErrorAccount(email, password, platformName, error) {
  ensureOutputDirs();
  const line = `${email}|${password}|${platformName}|${error}\n`;
  appendFileSync(config.ERROR_ACCOUNTS_FILE, line);
}

export function removeAccountFromFile(email) {
  if (!existsSync(config.ACCOUNT_FILE)) return;

  const lines = readFileSync(config.ACCOUNT_FILE, 'utf-8').split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return true;
    const parts = trimmed.split('|');
    return parts[0] !== email;
  });

  writeFileSync(config.ACCOUNT_FILE, filtered.join('\n'));
}

// ─── Output directories ──────────────────────────────────

export function ensureOutputDirs() {
  const dirs = [config.OUTPUT_DIR, config.KEYS_DIR, config.ERRORS_DIR];
  for (const dir of dirs) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// ─── Proxy management ────────────────────────────────────

let proxyPool = [];
let proxyIndex = 0;

export function loadProxyPool() {
  if (!existsSync(config.PROXY_POOL_FILE)) return [];
  const lines = readFileSync(config.PROXY_POOL_FILE, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  proxyPool = lines;
  return proxyPool;
}

export function acquireProxy(pool) {
  if (!pool || pool.length === 0) return null;
  const proxy = pool[proxyIndex % pool.length];
  proxyIndex++;
  return proxy;
}

export function releaseProxy(/* proxy */) {
  // No-op for now; round-robin doesn't need release
}

// ─── Browser helpers ─────────────────────────────────────

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
];

export function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}
