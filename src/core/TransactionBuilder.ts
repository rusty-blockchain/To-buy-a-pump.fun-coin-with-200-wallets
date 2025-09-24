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
    // Pump.fun program ID (verified)
    const pumpFunProgramId = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
    
    // Get the token mint from config (user must specify which token to buy)
    const tokenMint = new PublicKey(config.pumpFun.tokenAccount || 'So11111111111111111111111111111111111111112'); // Default to SOL if not specified
    
    // Create associated token account for the buyer
    const buyerTokenAccount = await this.getAssociatedTokenAddress(tokenMint, new PublicKey(wallet.publicKey));
    
    // Pump.fun bonding curve account (derived from token mint)
    const bondingCurve = await this.getBondingCurveAddress(tokenMint);
    
    // Fee recipient (pump.fun fee account)
    const feeRecipient = new PublicKey('CebN5qYFQYqHkEMB2gqF8BfLJ2gYdG7iHsPg9S6wR5vK'); // Pump.fun fee recipient
    
    // System program for SOL transfers
    const systemProgram = SystemProgram.programId;
    
    // Token program for SPL token operations
    const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    
    // Rent sysvar
    const rentSysvar = new PublicKey('SysvarRent111111111111111111111111111111111');
    
    // Calculate purchase amount in lamports
    const purchaseAmount = Math.floor(this.transactionConfig.purchaseAmount * LAMPORTS_PER_SOL);
    
    // Create pump.fun buy instruction data
    const instructionData = this.createPumpFunBuyInstructionData(purchaseAmount);
    
    return new TransactionInstruction({
      keys: [
        // Buyer wallet (signer)
        {
          pubkey: new PublicKey(wallet.publicKey),
          isSigner: true,
          isWritable: true,
        },
        // Token mint
        {
          pubkey: tokenMint,
          isSigner: false,
          isWritable: true,
        },
        // Bonding curve account
        {
          pubkey: bondingCurve,
          isSigner: false,
          isWritable: true,
        },
        // Buyer's token account
        {
          pubkey: buyerTokenAccount,
          isSigner: false,
          isWritable: true,
        },
        // Fee recipient
        {
          pubkey: feeRecipient,
          isSigner: false,
          isWritable: true,
        },
        // System program
        {
          pubkey: systemProgram,
          isSigner: false,
          isWritable: false,
        },
        // Token program
        {
          pubkey: tokenProgram,
          isSigner: false,
          isWritable: false,
        },
        // Rent sysvar
        {
          pubkey: rentSysvar,
          isSigner: false,
          isWritable: false,
        },
      ],
      programId: pumpFunProgramId,
      data: instructionData,
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

  // Helper method to get associated token account address
  private async getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const { getAssociatedTokenAddress } = await import('@solana/spl-token');
    return await getAssociatedTokenAddress(mint, owner);
  }

  // Helper method to get pump.fun bonding curve address
  private async getBondingCurveAddress(tokenMint: PublicKey): Promise<PublicKey> {
    // Pump.fun bonding curve is derived from token mint
    // This is a simplified version - in reality, you'd need to call the program to get the exact address
    const [bondingCurve] = await PublicKey.findProgramAddress(
      [Buffer.from('bonding_curve'), tokenMint.toBuffer()],
      this.pumpFunProgramId
    );
    return bondingCurve;
  }

  // Create pump.fun buy instruction data
  private createPumpFunBuyInstructionData(amount: number): Buffer {
    // Pump.fun buy instruction format (based on Anchor framework):
    // - Instruction discriminator (8 bytes) - "buy" instruction
    // - Amount in lamports (8 bytes)
    // - Slippage tolerance (8 bytes)
    
    // "buy" instruction discriminator (Anchor uses first 8 bytes of sha256("global:buy"))
    const instructionDiscriminator = Buffer.from([0x33, 0xE6, 0x85, 0x1A, 0x9F, 0x5B, 0x4D, 0x8B]);
    
    // Amount in lamports (little-endian)
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount), 0);
    
    // Slippage tolerance in basis points (1% = 100 basis points)
    const slippageBuffer = Buffer.alloc(8);
    slippageBuffer.writeBigUInt64LE(BigInt(100), 0);
    
    return Buffer.concat([instructionDiscriminator, amountBuffer, slippageBuffer]);
  }
}
