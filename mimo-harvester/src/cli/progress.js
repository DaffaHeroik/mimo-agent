import cliProgress from 'cli-progress';
import chalk from 'chalk';

const bars = new Map();

/**
 * Create or get a progress bar for a platform.
 */
export function createProgressBar(platform, total) {
  if (bars.has(platform)) {
    const existing = bars.get(platform);
    existing.bar.setTotal(total);
    return existing;
  }

  const bar = new cliProgress.SingleBar(
    {
      format: `${chalk.cyan(platform.padEnd(12))} |${chalk.green('{bar}')}| {percentage}% | {value}/{total} | ETA: {eta}s | ${chalk.yellow('{status}')}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  bar.start(total, 0, { status: 'Starting...' });
  const wrapper = {
    bar,
    updateProgress(current, status = '') {
      bar.update(current, { status });
    },
    increment(status = '') {
      bar.increment(1, { status });
    },
    stop() {
      bar.stop();
      bars.delete(platform);
    },
  };

  bars.set(platform, wrapper);
  return wrapper;
}

/**
 * Update a progress bar's status text.
 */
export function updateStatus(platform, status) {
  const wrapper = bars.get(platform);
  if (wrapper) {
    wrapper.bar.update(undefined, { status });
  }
}

/**
 * Stop all progress bars.
 */
export function stopAll() {
  for (const [platform, wrapper] of bars) {
    wrapper.bar.stop();
    bars.delete(platform);
  }
}
