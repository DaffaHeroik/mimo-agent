import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import config from '../config/index.js';

/**
 * Print a summary report after harvesting.
 */
export function printReport(results) {
  console.log('\n' + chalk.bold.cyan('═'.repeat(60)));
  console.log(chalk.bold.cyan('  📊 HARVEST REPORT'));
  console.log(chalk.bold.cyan('═'.repeat(60)));

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const [platform, data] of Object.entries(results)) {
    const success = data.success || 0;
    const failed = data.failed || 0;
    totalSuccess += success;
    totalFailed += failed;

    const statusIcon = success > 0 ? chalk.green('✓') : chalk.red('✗');
    console.log(
      `  ${statusIcon} ${chalk.bold(platform.padEnd(14))} ` +
        `${chalk.green(`${success} success`)} | ${chalk.red(`${failed} failed`)}`
    );
  }

  console.log(chalk.cyan('─'.repeat(60)));
  console.log(
    `  ${chalk.bold('TOTAL')}  ${chalk.green(`${totalSuccess} success`)} | ${chalk.red(`${totalFailed} failed`)}`
  );
  console.log(chalk.bold.cyan('═'.repeat(60)));

  // Show output file locations
  console.log(chalk.bold('\n📁 Output Files:'));
  for (const platform of Object.keys(results)) {
    const keyFile = `${config.KEYS_DIR}/${platform}_keys.txt`;
    if (existsSync(keyFile)) {
      const lines = readFileSync(keyFile, 'utf-8').split('\n').filter(Boolean).length;
      console.log(`  ${chalk.yellow('→')} ${keyFile} (${lines} entries)`);
    }
  }

  if (existsSync(config.ERROR_ACCOUNTS_FILE)) {
    const errLines = readFileSync(config.ERROR_ACCOUNTS_FILE, 'utf-8').split('\n').filter(Boolean).length;
    console.log(`  ${chalk.red('→')} ${config.ERROR_ACCOUNTS_FILE} (${errLines} entries)`);
  }

  console.log('');
}
