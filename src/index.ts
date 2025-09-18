#!/usr/bin/env node

import { config, validateConfig } from './utils/config';
import { WalletManager } from './core/WalletManager';
import { TransactionBuilder } from './core/TransactionBuilder';
import { SynchronizationEngine } from './core/SynchronizationEngine';
import { BlockMonitor } from './core/BlockMonitor';
import { logger } from './utils/logger';

/**
 * Main execution class for the pump.fun multi-wallet bot
 */
class PumpFunMultiWalletBot {
  private walletManager: WalletManager;
  private transactionBuilder: TransactionBuilder;
  private synchronizationEngine: SynchronizationEngine;
  private blockMonitor: BlockMonitor;

  constructor() {
    this.walletManager = new WalletManager();
    this.transactionBuilder = new TransactionBuilder();
    this.synchronizationEngine = new SynchronizationEngine(this.walletManager);
    this.blockMonitor = new BlockMonitor();
  }

  /**
   * Initialize the bot and prepare for execution
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing Pump.fun Multi-Wallet Bot...');

      // Validate configuration
      if (!validateConfig()) {
        throw new Error('Invalid configuration');
      }

      // Initialize wallet manager
      await this.walletManager.initialize();
      logger.info(`Initialized ${config.wallet.count} wallets`);

      // Fund wallets if on testnet/devnet and they have insufficient balance
      if (config.network === 'testnet' || config.network === 'devnet') {
        const readyWallets = this.walletManager.getReadyWalletCount();
        if (readyWallets === 0) {
          logger.info('No wallets ready, funding wallets with test SOL...');
          await this.walletManager.fundWallets();
        }
      }

      // Initialize transaction builder
      await this.transactionBuilder.initialize();
      logger.info('Transaction builder initialized');

      // Initialize synchronization engine
      await this.synchronizationEngine.initialize();
      logger.info('Synchronization engine initialized');

      // Initialize block monitor
      await this.blockMonitor.initialize();
      logger.info('Block monitor initialized');

      logger.info('Bot initialization complete');
      return true;

    } catch (error) {
      logger.error('Failed to initialize bot:', error);
      return false;
    }
  }

  /**
   * Execute the main buying operation
   */
  async execute(): Promise<void> {
    try {
      logger.info('Starting pump.fun multi-wallet execution...');

      // Check if we have ready wallets
      const readyWallets = this.walletManager.getReadyWallets();
      if (readyWallets.length === 0) {
        throw new Error('No wallets are ready for execution. Please fund the wallets first.');
      }

      logger.info(`Using ${readyWallets.length} ready wallets for execution`);

      // Prepare transactions for ready wallets only
      const transactions = await this.transactionBuilder.prepareTransactions(readyWallets);
      logger.info(`Prepared ${transactions.length} transactions`);

      // Synchronize execution timing
      const executionTime = await this.synchronizationEngine.calculateOptimalTiming();
      logger.info(`Scheduled execution for: ${new Date(executionTime).toISOString()}`);

      // Execute all transactions simultaneously
      const results = await this.synchronizationEngine.executeSimultaneously(
        transactions,
        executionTime
      );

      // Monitor block inclusion
      const verification = await this.blockMonitor.verifyBlockInclusion(
        results.transactionHashes
      );

      // Generate final report
      this.generateReport(verification);

    } catch (error) {
      logger.error('Execution failed:', error);
      throw error;
    }
  }

  /**
   * Generate execution report
   */
  private generateReport(verification: any): void {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 PUMP.FUN MULTI-WALLET EXECUTION REPORT');
    console.log('='.repeat(80));
    
    const txCount = Array.isArray(verification.transactionHashes) ? verification.transactionHashes.length : 0;
    const successRate = typeof verification.successRate === 'number' && isFinite(verification.successRate)
      ? verification.successRate
      : (txCount === 0 ? 0 : verification.successRate);
    console.log(`📊 Success Rate: ${successRate}%`);
    console.log(`🔗 Block Height: ${verification.blockHeight}`);
    if (typeof verification.executionTime === 'number' && isFinite(verification.executionTime)) {
      console.log(`⏱️  Execution Time: ${verification.executionTime}ms`);
    }
    console.log(`✅ Transactions in Same Block: ${verification.allInSameBlock ? 'YES' : 'NO'}`);
    
    console.log('\n📋 Transaction Hashes:');
    if (txCount > 0) {
      verification.transactionHashes.forEach((tx: any, index: number) => {
        console.log(`${index + 1}. ${tx.wallet}: ${tx.hash}`);
      });
    } else {
      console.log('(no transactions)');
    }
    
    console.log('\n' + '='.repeat(80));
  }

  /**
   * Run a small batch test (5-10 wallets)
   */
  async runSmallTest(): Promise<void> {
    logger.info('Running small batch test...');
    
    // Temporarily reduce wallet count for testing
    const originalCount = config.wallet.count;
    config.wallet.count = 5;
    
    try {
      await this.initialize();
      await this.execute();
    } finally {
      // Restore original count
      config.wallet.count = originalCount;
    }
  }
}

// Main execution
async function main() {
  const bot = new PumpFunMultiWalletBot();
  
  try {
    // Check command line arguments
    const args = process.argv.slice(2);
    
    if (args.includes('--test')) {
      await bot.runSmallTest();
    } else {
      await bot.initialize();
      await bot.execute();
    }
    
  } catch (error) {
    logger.error('Bot execution failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the bot
if (require.main === module) {
  main();
}

export { PumpFunMultiWalletBot };
