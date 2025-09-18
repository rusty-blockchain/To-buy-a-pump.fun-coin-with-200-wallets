import { Connection } from '@solana/web3.js';
import { config, createConnection } from '../utils/config';
import { logger, logSynchronization } from '../utils/logger';
import { SynchronizationConfig, ExecutionResult } from '../types/interfaces';
import { TransactionBuilder } from './TransactionBuilder';
import { WalletManager } from './WalletManager';

export class SynchronizationEngine {
  private connection: Connection;
  private connectionPool: Connection[];
  private syncConfig: SynchronizationConfig;
  private transactionBuilder: TransactionBuilder;
  private walletManager: WalletManager;
  private currentSlot: number = 0;
  private slotSubscription: number | null = null;

  constructor(walletManager?: WalletManager) {
    this.connection = createConnection();
    this.connectionPool = [];
    this.syncConfig = {
      precisionMs: config.execution.syncPrecisionMs,
      networkLatency: 100, // Default 100ms
      blockTime: 400, // Solana block time ~400ms
      bufferTime: 0 // Zero buffer for perfect timing
    };
    this.transactionBuilder = new TransactionBuilder();
    this.walletManager = walletManager || new WalletManager();
  }

  /**
   * Initialize synchronization engine
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing synchronization engine...');
      
      // Create connection pool for parallel broadcasting
      await this.createConnectionPool();
      
      // Measure network latency
      await this.measureNetworkLatency();
      
      // Start slot monitoring
      await this.startSlotMonitoring();
      
      logger.info('Synchronization engine initialized');
    } catch (error) {
      logger.error('Failed to initialize synchronization engine:', error);
      throw error;
    }
  }

  /**
   * Create connection pool for parallel broadcasting
   */
  private async createConnectionPool(): Promise<void> {
    const poolSize = 3; // Use only 3 connections to avoid rate limits
    logger.info(`Creating connection pool with ${poolSize} connections...`);
    
    this.connectionPool = [];
    
    // Use only the main Solana devnet RPC (most reliable)
    const rpcUrl = 'https://api.devnet.solana.com';
    
    for (let i = 0; i < poolSize; i++) {
      const connection = new Connection(rpcUrl, {
        commitment: 'processed',
        confirmTransactionInitialTimeout: 2000,
        disableRetryOnRateLimit: true // Disable retries to avoid delays
      });
      this.connectionPool.push(connection);
    }
    
    logger.info(`Connection pool created with ${this.connectionPool.length} connections using main Solana devnet RPC`);
  }

  /**
   * Measure network latency
   */
  private async measureNetworkLatency(): Promise<void> {
    logger.info('Measuring network latency...');
    
    const measurements: number[] = [];
    const iterations = 5;
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        await this.connection.getSlot();
        const end = Date.now();
        measurements.push(end - start);
      } catch (error) {
        logger.warn(`Latency measurement ${i + 1} failed:`, error);
      }
      
      // Small delay between measurements
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (measurements.length > 0) {
      const averageLatency = measurements.reduce((sum, lat) => sum + lat, 0) / measurements.length;
      this.syncConfig.networkLatency = Math.ceil(averageLatency);
      logger.info(`Average network latency: ${this.syncConfig.networkLatency}ms`);
    }
  }

  /**
   * Start monitoring slot changes
   */
  private async startSlotMonitoring(): Promise<void> {
    try {
      this.slotSubscription = this.connection.onSlotChange((slotInfo) => {
        this.currentSlot = slotInfo.slot;
      });
      
      // Get initial slot
      this.currentSlot = await this.connection.getSlot();
      logger.info(`Current slot: ${this.currentSlot}`);
    } catch (error) {
      logger.error('Failed to start slot monitoring:', error);
      throw error;
    }
  }

  /**
   * Calculate optimal execution timing
   */
  async calculateOptimalTiming(): Promise<number> {
    try {
      logger.info('Calculating optimal execution timing...');
      
      // Get current slot
      const currentSlot = await this.connection.getSlot();
      
      // Target the next slot boundary
      const targetSlot = currentSlot + 1;
      const currentTime = Date.now();
      
      // Aim slightly after the expected next block time with minimal buffer
      const estimatedBlockTime = currentTime + this.syncConfig.blockTime;
      const executionTime = estimatedBlockTime + this.syncConfig.bufferTime;
      
      logger.info(`Target slot: ${targetSlot}`);
      logger.info(`Execution time: ${new Date(executionTime).toISOString()}`);
      logger.info(`Time until execution: ${executionTime - currentTime}ms`);
      
      return executionTime;
    } catch (error) {
      logger.error('Failed to calculate optimal timing:', error);
      throw error;
    }
  }

  /**
   * Execute all transactions simultaneously with ULTRA-FAST timing
   */
  async executeSimultaneously(
    transactions: any[],
    executionTime: number
  ): Promise<ExecutionResult> {
    try {
      logger.info(`Executing ${transactions.length} transactions with ULTRA-FAST timing...`);
      
      const readyWallets = this.walletManager.getReadyWallets();
      const startTime = performance.now();
      
      // Pre-sign all transactions before slot edge
      logger.info('Pre-signing all transactions...');
      const preSignedTransactions = await Promise.all(
        transactions.map(async (tx, index) => {
          const wallet = readyWallets[index];
          if (!wallet) {
            throw new Error(`Wallet at index ${index} not found in ready wallets`);
          }
          return await this.transactionBuilder.signTransaction(tx, wallet);
        })
      );
      
      // ULTRA-FAST: Single slot with maximum precision
      const startSlot = await this.connection.getSlot();
      const targetSlot = startSlot + 1;
      
      logger.info(`🎯 ULTRA-FAST: Targeting single slot ${targetSlot} with maximum precision...`);
      
      // Wait for the exact slot edge
      logger.info(`⏰ Waiting for slot ${targetSlot} edge...`);
      await this.waitForSlotEdge(targetSlot);
      
      // Get fresh blockhash at the exact slot edge
      const { blockhash } = await this.connection.getLatestBlockhash();
      logger.info(`🎯 Got fresh blockhash: ${blockhash}`);
      
      // Update all transactions with fresh blockhash and re-sign quickly
      const finalTransactions = await Promise.all(
        preSignedTransactions.map(async (tx, index) => {
          const updatedTx = await this.transactionBuilder.updateTransactionBlockhash(tx, blockhash);
          const wallet = readyWallets[index];
          return await this.transactionBuilder.signTransaction(updatedTx, wallet);
        })
      );
      
      // Serialize all transactions
      const serializedTxs = finalTransactions.map(t => t.serialize());
      
      // Fire all transactions simultaneously using connection pool
      const sendStartTime = performance.now();
      logger.info('🚀 FIRING ALL TRANSACTIONS SIMULTANEOUSLY...');
      
      // Use micro-batching: send in groups of 2 for maximum speed
      const batchSize = 2;
      const executionPromises: Promise<any>[] = [];
      
      for (let i = 0; i < serializedTxs.length; i += batchSize) {
        const batch = serializedTxs.slice(i, i + batchSize);
        const batchPromises = batch.map((bytes, batchIndex) => {
          const globalIndex = i + batchIndex;
          const connection = this.connectionPool[globalIndex % this.connectionPool.length];
          
          return connection.sendRawTransaction(bytes, {
            skipPreflight: true,
            preflightCommitment: 'processed',
            maxRetries: 0 // No retries for speed
          })
          .then(signature => {
            const sendTime = performance.now() - sendStartTime;
            logger.info(`⚡ TX-${globalIndex + 1} sent in ${sendTime.toFixed(2)}ms: ${signature}`);
            return {
              success: true,
              signature,
              wallet: readyWallets[globalIndex]?.publicKey || 'unknown',
              sendTime
            };
          })
          .catch(error => {
            const sendTime = performance.now() - sendStartTime;
            logger.error(`❌ TX-${globalIndex + 1} failed in ${sendTime.toFixed(2)}ms:`, error);
            return {
              success: false,
              signature: null,
              wallet: readyWallets[globalIndex]?.publicKey || 'unknown',
              error: error instanceof Error ? error.message : String(error),
              sendTime
            };
          });
        });
        
        executionPromises.push(...batchPromises);
        
        // Small delay between batches to avoid overwhelming the RPC
        if (i + batchSize < serializedTxs.length) {
          await new Promise(resolve => setTimeout(resolve, 1)); // 1ms delay
        }
      }
      
      // Wait for all transactions to complete
      const results = await Promise.all(executionPromises);
      
      const endTime = performance.now();
      const executionTimeMs = endTime - startTime;
      
      // Analyze results
      const successfulTxs = results.filter(r => r.success);
      const failedTxs = results.filter(r => !r.success);
      const successRate = (successfulTxs.length / results.length) * 100;
      
      // Calculate average send time
      const avgSendTime = results.reduce((sum, r) => sum + (r.sendTime || 0), 0) / results.length;
      
      const executionResult: ExecutionResult = {
        success: successRate > 0,
        transactionHashes: successfulTxs.map(r => ({ wallet: r.wallet, hash: r.signature! })),
        blockHeight: this.currentSlot,
        blockHash: blockhash,
        executionTime: executionTimeMs,
        successRate,
        failedWallets: failedTxs.map(r => r.wallet),
        gasUsed: 0 // Will be calculated later
      };
      
      logSynchronization(executionTimeMs, this.syncConfig.precisionMs, transactions.length);
      
      logger.info(`🎯 ULTRA-FAST EXECUTION COMPLETED!`);
      logger.info(`✅ Successful transactions: ${successfulTxs.length}/${results.length}`);
      logger.info(`📊 Success rate: ${successRate.toFixed(2)}%`);
      logger.info(`⏱️ Total execution time: ${executionTimeMs.toFixed(2)}ms`);
      logger.info(`🚀 Average send time: ${avgSendTime.toFixed(2)}ms`);
      logger.info(`🎲 Sent on slot ${targetSlot} with maximum precision!`);
      
      return executionResult;
    } catch (error) {
      logger.error('Ultra-fast execution failed:', error);
      throw error;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * High precision sleep using performance.now()
   */
  private highPrecisionSleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      const check = () => {
        if (performance.now() - start >= ms) {
          resolve();
        } else {
          setImmediate(check);
        }
      };
      check();
    });
  }

  /**
   * Wait for specific slot
   */
  async waitForSlot(targetSlot: number): Promise<void> {
    logger.info(`Waiting for slot ${targetSlot}...`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for slot ${targetSlot}`));
      }, 10000); // 10 second timeout
      
      const checkSlot = () => {
        if (this.currentSlot >= targetSlot) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkSlot, 10); // Check every 10ms
        }
      };
      
      checkSlot();
    });
  }

  /**
   * Wait for slot edge using slot change subscription for perfect timing
   */
  async waitForSlotEdge(targetSlot: number): Promise<void> {
    logger.info(`Waiting for slot ${targetSlot} edge...`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for slot ${targetSlot} edge`));
      }, 10000); // 10 second timeout
      
      // Use slot change subscription for immediate response
      const slotChangeHandler = (slotInfo: any) => {
        if (slotInfo.slot >= targetSlot) {
          clearTimeout(timeout);
          // Remove the listener
          this.connection.removeSlotChangeListener(subscriptionId);
          resolve();
        }
      };
      
      // Add slot change listener
      const subscriptionId = this.connection.onSlotChange(slotChangeHandler);
      
      // Also check current slot in case we're already past the target
      if (this.currentSlot >= targetSlot) {
        clearTimeout(timeout);
        this.connection.removeSlotChangeListener(subscriptionId);
        resolve();
      }
    });
  }

  /**
   * Get current slot
   */
  getCurrentSlot(): number {
    return this.currentSlot;
  }

  /**
   * Get synchronization configuration
   */
  getSyncConfig(): SynchronizationConfig {
    return this.syncConfig;
  }

  /**
   * Update synchronization configuration
   */
  updateSyncConfig(newConfig: Partial<SynchronizationConfig>): void {
    this.syncConfig = { ...this.syncConfig, ...newConfig };
    logger.info('Synchronization configuration updated:', this.syncConfig);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.slotSubscription !== null) {
        await this.connection.removeSlotChangeListener(this.slotSubscription);
        this.slotSubscription = null;
      }
      logger.info('Synchronization engine cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup synchronization engine:', error);
    }
  }
}
