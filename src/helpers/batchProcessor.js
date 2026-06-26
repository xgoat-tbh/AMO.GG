import { logger } from './logger.js';

/**
 * Rate-limit-safe batch processor for Discord API calls.
 * Used by mass role operations (?inrole), voice lockdown, etc.
 */

/**
 * Process items with controlled concurrency and progress reporting.
 *
 * @param {Array} items - Items to process
 * @param {Function} asyncFn - Async function to call per item: (item, index) => Promise
 * @param {Object} options
 * @param {number} options.concurrency - Max parallel operations (default: 3)
 * @param {Function} options.onProgress - Called with (completed, total) periodically
 * @param {number} options.progressInterval - Min ms between progress reports (default: 2000)
 * @returns {{ succeeded: number, failed: number, total: number, errors: Error[] }}
 */
export async function processBatch(items, asyncFn, options = {}) {
  const {
    concurrency = 3,
    onProgress = null,
    progressInterval = 2000,
  } = options;

  const total = items.length;
  let succeeded = 0;
  let failed = 0;
  const errors = [];
  let lastProgressTime = 0;

  function reportProgress() {
    if (!onProgress) return;
    const now = Date.now();
    if (now - lastProgressTime >= progressInterval) {
      lastProgressTime = now;
      onProgress(succeeded + failed, total);
    }
  }

  // Process in chunks of `concurrency`
  for (let i = 0; i < total; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      chunk.map((item, idx) => asyncFn(item, i + idx))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        succeeded++;
      } else {
        failed++;
        errors.push(result.reason);
        logger.warn('BATCH', `Item failed: ${result.reason?.message || 'Unknown error'}`);
      }
    }

    reportProgress();

    // Small delay between chunks to avoid rate limits
    if (i + concurrency < total) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Final progress report
  if (onProgress) {
    onProgress(total, total);
  }

  return { succeeded, failed, total, errors };
}
