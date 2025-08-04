// utils/logger.js
// Simple logger utility to replace console statements in production code

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

function shouldLog(level) {
  return LOG_LEVELS[level] <= currentLevel;
}

function formatMessage(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] ${level}:`;
  
  if (args.length > 0) {
    return [prefix, message, ...args];
  }
  return [prefix, message];
}

const logger = {
  error: (message, ...args) => {
    if (shouldLog('ERROR')) {
      // eslint-disable-next-line no-console
      console.error(...formatMessage('ERROR', message, ...args));
    }
  },
  
  warn: (message, ...args) => {
    if (shouldLog('WARN')) {
      // eslint-disable-next-line no-console
      console.warn(...formatMessage('WARN', message, ...args));
    }
  },
  
  info: (message, ...args) => {
    if (shouldLog('INFO')) {
      // eslint-disable-next-line no-console
      console.log(...formatMessage('INFO', message, ...args));
    }
  },
  
  debug: (message, ...args) => {
    if (shouldLog('DEBUG')) {
      // eslint-disable-next-line no-console
      console.log(...formatMessage('DEBUG', message, ...args));
    }
  }
};

module.exports = logger;