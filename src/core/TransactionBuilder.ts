import { 
  Transaction, 
  TransactionInstruction, 
  PublicKey, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram
} from '@solana/web3.js';
const encodeUint64 = (value: bigint): Uint8Array => {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, value, true); // little-endian
  return new Uint8Array(buffer);
};
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

  private async createPumpFunTransaction(wallet: Wallet): Promise<Transaction> {
    const transaction = new Transaction();
    
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

    transaction.recentBlockhash = '11111111111111111111111111111111'; // Placeholder
    
    transaction.feePayer = new PublicKey(wallet.publicKey);

    return transaction;
  }

  private async createPurchaseInstruction(wallet: Wallet): Promise<TransactionInstruction> {
 
    const tokenProgramId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    
    const tokenMint = new PublicKey(wallet.publicKey);
    
    const sourceTokenAccount = new PublicKey('11111111111111111111111111111112'); // System program as placeholder
    
    const destinationTokenAccount = new PublicKey('11111111111111111111111111111113'); // System program as placeholder
    
    const transferAmount = Math.floor(this.transactionConfig.purchaseAmount * LAMPORTS_PER_SOL);
    
    return new TransactionInstruction({
      keys: [
        {
          pubkey: sourceTokenAccount,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: destinationTokenAccount,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: new PublicKey(wallet.publicKey),
          isSigner: true,
          isWritable: false,
        },
        {
          pubkey: tokenMint,
          isSigner: false,
          isWritable: false,
        },
      ],
      programId: tokenProgramId,
      data: Buffer.from([2, 0, 0, 0, ...encodeUint64(BigInt(transferAmount))]), // Transfer instruction
    });
  }

  async updateTransactionBlockhash(transaction: Transaction, recentBlockhash: string): Promise<Transaction> {
    transaction.recentBlockhash = recentBlockhash;
    return transaction;
  }

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

  serializeTransaction(transaction: Transaction): string {
    try {
      const serialized = transaction.serialize();
      return bs58.encode(serialized);
    } catch (error) {
      logger.error('Failed to serialize transaction:', error);
      throw error;
    }
  }

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

  getTransactionSize(transaction: Transaction): number {
    try {
      const serialized = transaction.serialize();
      return serialized.length;
    } catch (error) {
      logger.error('Failed to get transaction size:', error);
      return 0;
    }
  }

  getTransactionConfig(): TransactionConfig {
    return this.transactionConfig;
  }
}
