import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logDir = join(__dirname, '..', '..', 'logs');
const logFile = join(logDir, 'combined.log');

// Ensure log directory exists
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create logs directory:', err);
}

function stripAnsi(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function writeToLogFile(text) {
  try {
    fs.appendFileSync(logFile, stripAnsi(text) + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to write to combined.log:', err);
  }
}

/**
 * Structured console logger with timestamps and category tags.
 */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function timestamp() {
  return new Date().toISOString();
}

function format(level, tag, message) {
  const colors = {
    debug: COLORS.dim,
    info: COLORS.cyan,
    warn: COLORS.yellow,
    error: COLORS.red,
    success: COLORS.green,
  };
  const color = colors[level] || COLORS.reset;
  return `${COLORS.dim}${timestamp()}${COLORS.reset} ${color}[${level.toUpperCase()}]${COLORS.reset} ${COLORS.blue}[${tag}]${COLORS.reset} ${message}`;
}

export const logger = {
  debug(tag, message) {
    const formatted = format('debug', tag, message);
    console.debug(formatted);
    writeToLogFile(formatted);
  },

  info(tag, message) {
    const formatted = format('info', tag, message);
    console.log(formatted);
    writeToLogFile(formatted);
  },

  warn(tag, message) {
    const formatted = format('warn', tag, message);
    console.warn(formatted);
    writeToLogFile(formatted);
  },

  error(tag, message, error = null) {
    const formatted = format('error', tag, message);
    console.error(formatted);
    writeToLogFile(formatted);
    if (error?.stack) {
      console.error(COLORS.dim + error.stack + COLORS.reset);
      writeToLogFile(error.stack);
    }
  },

  success(tag, message) {
    const formatted = format('success', tag, message);
    console.log(formatted);
    writeToLogFile(formatted);
  },
};
