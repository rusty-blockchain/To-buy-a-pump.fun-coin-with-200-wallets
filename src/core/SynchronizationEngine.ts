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

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing synchronization engine...');
      
      await this.createConnectionPool();
      
      await this.measureNetworkLatency();
      
      await this.startSlotMonitoring();
      
      logger.info('Synchronization engine initialized');
    } catch (error) {
      logger.error('Failed to initialize synchronization engine:', error);
      throw error;
    }
  }

  private async createConnectionPool(): Promise<void> {
    const poolSize = 2; // Use only 2 connections to avoid rate limits
    logger.info(`Creating connection pool with ${poolSize} connections...`);
    
    this.connectionPool = [];
    
    const rpcUrl = 'https://api.devnet.solana.com';
    
    for (let i = 0; i < poolSize; i++) {
      const connection = new Connection(rpcUrl, {
        commitment: 'confirmed', // Use confirmed instead of processed for better reliability
        confirmTransactionInitialTimeout: 5000, // Increased timeout
        disableRetryOnRateLimit: false // Allow retries for better success rate
      });
      this.connectionPool.push(connection);
    }
    
    logger.info(`Connection pool created with ${this.connectionPool.length} connections using main Solana devnet RPC`);
  }

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
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (measurements.length > 0) {
      const averageLatency = measurements.reduce((sum, lat) => sum + lat, 0) / measurements.length;
      this.syncConfig.networkLatency = Math.ceil(averageLatency);
      logger.info(`Average network latency: ${this.syncConfig.networkLatency}ms`);
    }
  }

  private async startSlotMonitoring(): Promise<void> {
    try {
      this.slotSubscription = this.connection.onSlotChange((slotInfo) => {
        this.currentSlot = slotInfo.slot;
      });
      
      this.currentSlot = await this.connection.getSlot();
      logger.info(`Current slot: ${this.currentSlot}`);
    } catch (error) {
      logger.error('Failed to start slot monitoring:', error);
      throw error;
    }
  }

  async calculateOptimalTiming(): Promise<number> {
    try {
      logger.info('Calculating optimal execution timing...');

      const currentSlot = await this.connection.getSlot();
      
      const targetSlot = currentSlot + 1;
      const currentTime = Date.now();
      
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
      
      const currentSlot = await this.connection.getSlot();
      const targetSlot = currentSlot + 2; // Target 2 slots ahead for better timing
      
      logger.info(`🎯 ULTRA-FAST: Targeting slot ${targetSlot} for maximum same-block inclusion...`);
      
      logger.info(`⏰ Waiting for slot ${targetSlot} edge with microsecond precision...`);
      await this.waitForSlotEdge(targetSlot);
      
      const { blockhash } = await this.connection.getLatestBlockhash();
      logger.info(`🎯 Got fresh blockhash: ${blockhash} for slot ${targetSlot}`);
      
      logger.info('🔄 Updating all transactions with fresh blockhash...');
      const finalTransactions = await Promise.all(
        preSignedTransactions.map(async (tx, index) => {
          const updatedTx = await this.transactionBuilder.updateTransactionBlockhash(tx, blockhash);
          const wallet = readyWallets[index];
          return await this.transactionBuilder.signTransaction(updatedTx, wallet);
        })
      );
      
      logger.info(`✅ All ${finalTransactions.length} transactions updated and signed`);
      
      const serializedTxs = finalTransactions.map(t => t.serialize());
      
      const sendStartTime = performance.now();
      logger.info('🚀 FIRING ALL TRANSACTIONS SIMULTANEOUSLY...');
      
      logger.info(`🚀 BURST MODE: FIRING ALL ${serializedTxs.length} TRANSACTIONS IN MICROSECOND BURST...`);
      
      const executionPromises = serializedTxs.map((bytes, index) => {
        const connection = this.connectionPool[index % this.connectionPool.length];
        
        return () => connection.sendRawTransaction(bytes, {
          skipPreflight: true,
          preflightCommitment: 'processed',
          maxRetries: 0 // No retries for maximum speed
        })
        .then(signature => {
          const sendTime = performance.now() - sendStartTime;
          logger.info(`⚡ TX-${index + 1} sent in ${sendTime.toFixed(2)}ms: ${signature}`);
          return {
            success: true,
            signature,
            wallet: readyWallets[index]?.publicKey || 'unknown',
            sendTime
          };
        })
        .catch(error => {
          const sendTime = performance.now() - sendStartTime;
          logger.error(`❌ TX-${index + 1} failed in ${sendTime.toFixed(2)}ms:`, error);
          return {
            success: false,
            signature: null,
            wallet: readyWallets[index]?.publicKey || 'unknown',
            error: error instanceof Error ? error.message : String(error),
            sendTime
          };
        });
      });
      
      logger.info('⚡ Executing burst mode with microsecond precision...');
      const results = await Promise.all(executionPromises.map(promise => 
        new Promise(resolve => {
          setImmediate(() => {
            promise().then(resolve).catch(resolve);
          });
        })
      ));
      
      const endTime = performance.now();
      const executionTimeMs = endTime - startTime;
      
      const successfulTxs = results.filter((r: any) => r.success);
      const failedTxs = results.filter((r: any) => !r.success);
      const successRate = (successfulTxs.length / results.length) * 100;
      
      const avgSendTime = results.reduce((sum: number, r: any) => sum + (r.sendTime || 0), 0) / results.length;
      
      const executionResult: ExecutionResult = {
        success: successRate > 0,
        transactionHashes: successfulTxs.map((r: any) => ({ wallet: r.wallet, hash: r.signature! })),
        blockHeight: this.currentSlot,
        blockHash: blockhash,
        executionTime: executionTimeMs,
        successRate,
        failedWallets: failedTxs.map((r: any) => r.wallet),
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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

  async waitForSlotEdge(targetSlot: number): Promise<void> {
    logger.info(`Waiting for slot ${targetSlot} edge...`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for slot ${targetSlot} edge`));
      }, 15000); // 15 second timeout for better reliability
      
      let slotReached = false;
      
      const slotChangeHandler = (slotInfo: any) => {
        this.currentSlot = slotInfo.slot;
        
        if (slotInfo.slot >= targetSlot && !slotReached) {
          slotReached = true;
          clearTimeout(timeout);
          this.connection.removeSlotChangeListener(subscriptionId);
          
          setTimeout(() => {
            resolve();
          }, 100); // 100ms delay to ensure slot edge timing
        }
      };
      
      const subscriptionId = this.connection.onSlotChange(slotChangeHandler);
      
      if (this.currentSlot >= targetSlot && !slotReached) {
        slotReached = true;
        clearTimeout(timeout);
        this.connection.removeSlotChangeListener(subscriptionId);
        setTimeout(() => {
          resolve();
        }, 100);
      }
    });
  }

  getCurrentSlot(): number {
    return this.currentSlot;
  }

  getSyncConfig(): SynchronizationConfig {
    return this.syncConfig;
  }


  updateSyncConfig(newConfig: Partial<SynchronizationConfig>): void {
    this.syncConfig = { ...this.syncConfig, ...newConfig };
    logger.info('Synchronization configuration updated:', this.syncConfig);
  }


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
