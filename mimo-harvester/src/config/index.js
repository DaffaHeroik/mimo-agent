import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

config({ path: resolve(ROOT, '.env') });

const env = {
  CHROME_EXECUTABLE_PATH: process.env.CHROME_EXECUTABLE_PATH || '',
  BROWSER_COUNT: parseInt(process.env.BROWSER_COUNT || '2', 10),
  BROWSER_SLOW_MO: parseInt(process.env.BROWSER_SLOW_MO || '2', 10),
  PW_HEADLESS: process.env.PW_HEADLESS !== '0',
  ACCOUNT_FILE: resolve(ROOT, process.env.ACCOUNT_FILE || 'accounts.txt'),
  PROXY_POOL_FILE: resolve(ROOT, process.env.PROXY_POOL_FILE || 'proxies.txt'),
  TEMP_EMAIL_PROVIDER: process.env.TEMP_EMAIL_PROVIDER || 'mail.tm',
  MAIL_TM_API_KEY: process.env.MAIL_TM_API_KEY || '',
  DELAY_BETWEEN_ACCOUNTS_MS: parseInt(process.env.DELAY_BETWEEN_ACCOUNTS_MS || '5000', 10),
  OUTPUT_DIR: resolve(ROOT, process.env.OUTPUT_DIR || 'output'),
  ROOT,
};

// Derived paths
env.KEYS_DIR = resolve(env.OUTPUT_DIR, 'keys');
env.ERRORS_DIR = resolve(env.OUTPUT_DIR, 'errors');
env.ERROR_ACCOUNTS_FILE = resolve(env.ERRORS_DIR, 'errorAccounts.txt');

export default env;
