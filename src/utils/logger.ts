import winston from 'winston';
import { config } from './config';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'pump-fun-bot' },
  transports: [
    // Write all logs to file
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write errors to separate file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Helper functions for structured logging
export const logTransaction = (wallet: string, txHash: string, status: string) => {
  logger.info('Transaction executed', {
    wallet,
    txHash,
    status,
    timestamp: new Date().toISOString()
  });
};

export const logBlockInclusion = (blockHeight: number, txCount: number, successRate: number) => {
  logger.info('Block inclusion verified', {
    blockHeight,
    txCount,
    successRate,
    timestamp: new Date().toISOString()
  });
};

export const logSynchronization = (executionTime: number, precision: number, walletCount: number) => {
  logger.info('Synchronization executed', {
    executionTime,
    precision,
    walletCount,
    timestamp: new Date().toISOString()
  });
};
