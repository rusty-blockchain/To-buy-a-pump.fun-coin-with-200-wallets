import { 
  Transaction, 
  TransactionInstruction, 
  PublicKey, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { Wallet, TransactionConfig } from '../types/interfaces';
import bs58 from 'bs58';

export class TransactionBuilder {
  private pumpFunProgramId: PublicKey;
  private transactionConfig: TransactionConfig;

  constructor() {
    this.pumpFunProgramId = new PublicKey(config.pumpFun.programId);
    this.transactionConfig = {
      programId: config.pumpFun.programId,
      tokenAccount: config.pumpFun.tokenAccount,
      purchaseAmount: config.wallet.purchaseAmountSol,
      gasPrice: 0.000005, // 5000 lamports per signature
      priorityFee: 0.000001, // 1000 lamports priority fee
      maxRetries: config.execution.maxRetries,
      timeout: config.execution.timeoutMs
    };
  }

  /**
   * Initialize transaction builder
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing transaction builder...');
      logger.info(`Pump.fun Program ID: ${this.pumpFunProgramId.toBase58()}`);
      logger.info(`Purchase Amount: ${this.transactionConfig.purchaseAmount} SOL`);
      logger.info('Transaction builder initialized');
    } catch (error) {
      logger.error('Failed to initialize transaction builder:', error);
      throw error;
    }
  }

  /**
   * Prepare transactions for all wallets
   */
  async prepareTransactions(wallets: Wallet[]): Promise<Transaction[]> {
    logger.info(`Preparing transactions for ${wallets.length} wallets...`);
    
    const transactions: Transaction[] = [];
    
    for (const wallet of wallets) {
      try {
        const transaction = await this.createPumpFunTransaction(wallet);
        transactions.push(transaction);
      } catch (error) {
        logger.error(`Failed to create transaction for wallet ${wallet.publicKey}:`, error);
        throw error;
      }
    }
    
    logger.info(`Prepared ${transactions.length} transactions`);
    return transactions;
  }

  /**
   * Create a pump.fun purchase transaction (without LUT)
   */
  private async createPumpFunTransaction(wallet: Wallet): Promise<Transaction> {
    const transaction = new Transaction();
    
    // Add compute budget instructions (no LUT optimization)
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 200000 // Standard compute units
      })
    );
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100000 // Even higher priority fee to reduce queuing
      })
    );

    // Create pump.fun purchase instruction
    const purchaseInstruction = await this.createPurchaseInstruction(wallet);
    transaction.add(purchaseInstruction);

    // Set recent blockhash (will be updated before sending)
    transaction.recentBlockhash = '11111111111111111111111111111111'; // Placeholder
    
    // Set fee payer
    transaction.feePayer = new PublicKey(wallet.publicKey);

    return transaction;
  }

  /**
   * Create pump.fun purchase instruction
   * 
   * TODO: INTEGRATION REQUIRED
   * This is a simplified placeholder instruction. For production use, you need to:
   * 1. Research the actual pump.fun program instruction layout
   * 2. Include correct accounts: token mint, bonding curve, fee recipients, etc.
   * 3. Use proper instruction discriminator and data format
   * 4. Handle program-derived addresses (PDAs) correctly
   * 5. Test with actual pump.fun contracts on testnet first
   */
  private async createPurchaseInstruction(wallet: Wallet): Promise<TransactionInstruction> {
    // TEMPORARY: Use Memo Program for safe on-chain no-op testing.
    // This avoids program errors while validating end-to-end flow.
    const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const memoText = `pumpfun-placeholder:${wallet.publicKey}`;

    return new TransactionInstruction({
      keys: [],
      programId: memoProgramId,
      data: Buffer.from(memoText, 'utf8')
    });
  }

  /**
   * Update transaction with recent blockhash
   */
  async updateTransactionBlockhash(transaction: Transaction, recentBlockhash: string): Promise<Transaction> {
    transaction.recentBlockhash = recentBlockhash;
    return transaction;
  }

  /**
   * Sign transaction with wallet
   */
  async signTransaction(transaction: Transaction, wallet: Wallet): Promise<Transaction> {
    try {
      const keypair = {
        publicKey: new PublicKey(wallet.publicKey),
        secretKey: wallet.secretKey
      };
      
      transaction.sign(keypair);
      return transaction;
    } catch (error) {
      logger.error(`Failed to sign transaction for wallet ${wallet.publicKey}:`, error);
      throw error;
    }
  }

  /**
   * Serialize transaction for broadcasting
   */
  serializeTransaction(transaction: Transaction): string {
    try {
      const serialized = transaction.serialize();
      return bs58.encode(serialized);
    } catch (error) {
      logger.error('Failed to serialize transaction:', error);
      throw error;
    }
  }

  /**
   * Create a test transaction (for testing purposes)
   */
  async createTestTransaction(wallet: Wallet): Promise<Transaction> {
    const transaction = new Transaction();
    
    // Add compute budget
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 100000
      })
    );
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 500
      })
    );

    // Create a simple transfer instruction for testing
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: new PublicKey(wallet.publicKey),
      toPubkey: new PublicKey(wallet.publicKey), // Transfer to self (no-op)
      lamports: 1 // Minimal amount
    });
    
    transaction.add(transferInstruction);
    transaction.recentBlockhash = '11111111111111111111111111111111';
    transaction.feePayer = new PublicKey(wallet.publicKey);

    return transaction;
  }

  /**
   * Validate transaction before sending
   */
  validateTransaction(transaction: Transaction): boolean {
    try {
      // Check if transaction has required fields
      if (!transaction.recentBlockhash) {
        logger.error('Transaction missing recent blockhash');
        return false;
      }
      
      if (!transaction.feePayer) {
        logger.error('Transaction missing fee payer');
        return false;
      }
      
      if (transaction.instructions.length === 0) {
        logger.error('Transaction has no instructions');
        return false;
      }
      
      // Check if transaction is properly signed
      if (transaction.signatures.length === 0) {
        logger.error('Transaction is not signed');
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Transaction validation failed:', error);
      return false;
    }
  }

  /**
   * Get transaction size in bytes
   */
  getTransactionSize(transaction: Transaction): number {
    try {
      const serialized = transaction.serialize();
      return serialized.length;
    } catch (error) {
      logger.error('Failed to get transaction size:', error);
      return 0;
    }
  }

  /**
   * Get transaction configuration
   */
  getTransactionConfig(): TransactionConfig {
    return this.transactionConfig;
  }
}
