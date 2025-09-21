import { Connection, TransactionResponse } from '@solana/web3.js';
import { config, createConnection } from '../utils/config';
import { logger, logBlockInclusion } from '../utils/logger';
import { BlockInfo, VerificationResult } from '../types/interfaces';

export class BlockMonitor {
  private connection: Connection;
  private currentSlot: number = 0;
  private slotSubscription: number | null = null;

  constructor() {
    this.connection = createConnection();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing block monitor...');
      
      this.currentSlot = await this.connection.getSlot();
      
      this.slotSubscription = this.connection.onSlotChange((slotInfo) => {
        this.currentSlot = slotInfo.slot;
      });
      
      logger.info(`Block monitor initialized at slot ${this.currentSlot}`);
    } catch (error) {
      logger.error('Failed to initialize block monitor:', error);
      throw error;
    }
  }

  async verifyBlockInclusion(transactionHashes: Array<{ wallet: string; hash: string }>): Promise<VerificationResult> {  
    try {
      logger.info(`Verifying block inclusion for ${transactionHashes.length} transactions...`);
      
      await this.sleep(5000);
      
      // Get current slot
      const currentSlot = await this.connection.getSlot();
      
      // Check each transaction
      const transactionResults = await Promise.all(
        transactionHashes.map(async (txData) => {
          try {
            const txInfo = await this.connection.getTransaction(txData.hash, {
              commitment: 'confirmed'
            });
            
            if (txInfo) {
              return {
                wallet: txData.wallet,
                hash: txData.hash,
                confirmed: true,
                slot: txInfo.slot,
                blockTime: txInfo.blockTime ?? null
              };
            } else {
              return {
                wallet: txData.wallet,
                hash: txData.hash,
                confirmed: false,
                slot: null,
                blockTime: null
              };
            }
          } catch (error) {
            logger.error(`Failed to verify transaction ${txData.hash}:`, error);
            return {
              wallet: txData.wallet,
              hash: txData.hash,
              confirmed: false,
              slot: null,
              blockTime: null
            };
          }
        })
      );
      
      const confirmedTxs = transactionResults.filter(tx => tx.confirmed);
      const failedTxs = transactionResults.filter(tx => !tx.confirmed);
      
      const slots = confirmedTxs.map(tx => tx.slot).filter(slot => slot !== null);
      const uniqueSlots = [...new Set(slots)].sort((a, b) => a - b);
      
      const allInSameBlock = uniqueSlots.length === 1 || 
        (uniqueSlots.length <= 3 && uniqueSlots[uniqueSlots.length - 1] - uniqueSlots[0] <= 2);
      
      const successRate = (confirmedTxs.length / transactionHashes.length) * 100;
      const blockHeight = allInSameBlock ? uniqueSlots[0] : currentSlot;
      
      const result: VerificationResult = {
        allInSameBlock,
        blockHeight: blockHeight || currentSlot,
        transactionCount: confirmedTxs.length,
        successRate,
        transactionHashes: transactionResults
      };
      
      logBlockInclusion(blockHeight || currentSlot, confirmedTxs.length, successRate);
      
      logger.info(`Verification complete:`);
      logger.info(`- All in same block: ${allInSameBlock}`);
      logger.info(`- Block height: ${blockHeight || currentSlot}`);
      logger.info(`- Confirmed transactions: ${confirmedTxs.length}/${transactionHashes.length}`);
      logger.info(`- Success rate: ${successRate.toFixed(2)}%`);
      
      return result;
    } catch (error) {
      logger.error('Block inclusion verification failed:', error);
      throw error;
    }
  }

  async getBlockInfo(slot: number): Promise<BlockInfo | null> {
    try {
      const block = await this.connection.getBlock(slot, {
        commitment: 'confirmed'
      });
      
      if (!block) {
        return null;
      }
      
      const blockInfo: BlockInfo = {
        slot: slot,
        blockhash: block.blockhash,
        parentSlot: block.parentSlot,
        timestamp: block.blockTime || 0,
        transactionCount: block.transactions.length
      };
      
      return blockInfo;
    } catch (error) {
      logger.error(`Failed to get block info for slot ${slot}:`, error);
      return null;
    }
  }

  async monitorBlockProduction(durationMs: number): Promise<BlockInfo[]> {
    logger.info(`Monitoring block production for ${durationMs}ms...`);
    
    const blocks: BlockInfo[] = [];
    const startTime = Date.now();
    const endTime = startTime + durationMs;
    
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        try {
          const currentSlot = await this.connection.getSlot();
          const blockInfo = await this.getBlockInfo(currentSlot);
          
          if (blockInfo) {
            blocks.push(blockInfo);
            logger.info(`Block ${blockInfo.slot}: ${blockInfo.transactionCount} transactions`);
          }
          
          if (Date.now() >= endTime) {
            clearInterval(interval);
            resolve(blocks);
          }
        } catch (error) {
          logger.error('Block monitoring error:', error);
        }
      }, 100); // Check every 100ms
    });
  }

  async waitForBlocks(blockCount: number): Promise<void> {
    logger.info(`Waiting for ${blockCount} blocks...`);
    
    const startSlot = this.currentSlot;
    const targetSlot = startSlot + blockCount;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${blockCount} blocks`));
      }, 30000); // 30 second timeout
      
      const checkSlot = () => {
        if (this.currentSlot >= targetSlot) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkSlot, 100); // Check every 100ms
        }
      };
      
      checkSlot();
    });
  }

  async getTransactionDetails(transactionHash: string): Promise<TransactionResponse | null> {
    try {
      const tx = await this.connection.getTransaction(transactionHash, {
        commitment: 'confirmed'
      });
      
      return tx;
    } catch (error) {
      logger.error(`Failed to get transaction details for ${transactionHash}:`, error);
      return null;
    }
  }

  async isTransactionConfirmed(transactionHash: string): Promise<boolean> {
    try {
      const tx = await this.connection.getTransaction(transactionHash, {
        commitment: 'confirmed'
      });
      
      return tx !== null;
    } catch (error) {
      logger.error(`Failed to check transaction confirmation for ${transactionHash}:`, error);
      return false;
    }
  }

  getCurrentSlot(): number {
    return this.currentSlot;
  }

  async getBlockProductionRate(sampleSize: number = 10): Promise<number> {
    logger.info(`Calculating block production rate with ${sampleSize} samples...`);
    
    const startSlot = this.currentSlot;
    const startTime = Date.now();
    
    await this.waitForBlocks(sampleSize);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    const blockRate = (sampleSize * 1000) / duration; // blocks per second
    
    logger.info(`Block production rate: ${blockRate.toFixed(2)} blocks/second`);
    
    return blockRate;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup(): Promise<void> {
    try {
      if (this.slotSubscription !== null) {
        await this.connection.removeSlotChangeListener(this.slotSubscription);
        this.slotSubscription = null;
      }
      logger.info('Block monitor cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup block monitor:', error);
    }
  }
}
