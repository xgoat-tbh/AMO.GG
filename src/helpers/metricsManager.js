/**
 * Lightweight metrics manager for Amo.GG performance auditing.
 */
export const metricsManager = {
  commands: {},
  cacheHits: 0,
  cacheMisses: 0,
  errors: 0,

  recordCommand(name, duration, isError = false) {
    if (!this.commands[name]) {
      this.commands[name] = { totalDuration: 0, count: 0, errors: 0 };
    }
    this.commands[name].totalDuration += duration;
    this.commands[name].count++;
    if (isError) {
      this.commands[name].errors++;
      this.errors++;
    }
  },

  recordCacheHit() {
    this.cacheHits++;
  },

  recordCacheMiss() {
    this.cacheMisses++;
  },

  recordError() {
    this.errors++;
  },

  getCacheHitRate() {
    const total = this.cacheHits + this.cacheMisses;
    if (total === 0) return '100.0%';
    return `${((this.cacheHits / total) * 100).toFixed(1)}%`;
  },

  getAverageLatency(name) {
    const cmd = this.commands[name];
    if (!cmd || cmd.count === 0) return 0;
    return (cmd.totalDuration / cmd.count).toFixed(2);
  },

  getStats() {
    return {
      commands: this.commands,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: this.getCacheHitRate(),
      errors: this.errors,
    };
  }
};
