import {  
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { config, createConnection } from '../utils/config';
import { logger } from '../utils/logger';
import { Wallet } from '../types/interfaces';
import bs58 from 'bs58';

export class AirDrop {
  private connection: Connection;
  private fundingKeypair: Keypair;
  private fundingPublicKey: PublicKey;

  constructor() {
    this.connection = createConnection();
    this.fundingKeypair = this.createFundingKeypair();
    this.fundingPublicKey = this.fundingKeypair.publicKey;
  }

  private createFundingKeypair(): Keypair {
    if (!config.funding.privateKey || config.funding.privateKey === 'your_funding_wallet_private_key_here') {
      throw new Error('FUNDING_WALLET_PRIVATE_KEY not configured in .env file');
    }

    try {
      let privateKeyArray: number[];
      
      try {
        privateKeyArray = JSON.parse(config.funding.privateKey);
      } catch (jsonError) {
        try {
          privateKeyArray = Array.from(bs58.decode(config.funding.privateKey));
        } catch (base58Error) {
          privateKeyArray = config.funding.privateKey.split(',').map(n => parseInt(n.trim()));
        }
      }
      
      return Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    } catch (error) {
      logger.error('Failed to create funding keypair:', error);
      throw new Error('Invalid funding wallet private key format');
    }
  }

  /**
   * Check funding wallet balance
   */
  async checkFundingBalance(): Promise<number> {
    try {
      const balance = await this.connection.getBalance(this.fundingPublicKey);
      const balanceSol = balance / LAMPORTS_PER_SOL;
      
      logger.info(`💳 Funding wallet: ${this.fundingPublicKey.toBase58()}`);
      logger.info(`💰 Current balance: ${balanceSol.toFixed(4)} SOL`);
      
      return balanceSol;
    } catch (error) {
      logger.error('Failed to check funding balance:', error);
      throw error;
    }
  }

  async requestFundingAirdrop(amount: number = 50): Promise<void> {
    try {
      logger.info(`🪂 Requesting ${amount} SOL airdrop for funding wallet...`);
      
      const signature = await this.connection.requestAirdrop(
        this.fundingPublicKey,
        amount * LAMPORTS_PER_SOL
      );
      
      logger.info(`🪂 Airdrop transaction: ${signature}`);
      logger.info('⏳ Waiting for airdrop confirmation...');
      
      await Promise.race([
        this.connection.confirmTransaction(signature),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Airdrop timeout')), 60000))
      ]);
      
      const newBalance = await this.checkFundingBalance();
      logger.info(`✅ Airdrop successful! New balance: ${newBalance.toFixed(4)} SOL`);
      
    } catch (error) {
      logger.error('❌ Airdrop failed:', error);
      throw error;
    }
  }

  async ensureFundingBalance(requiredAmount: number): Promise<void> {
    const currentBalance = await this.checkFundingBalance();
    
    if (currentBalance < requiredAmount) {
      const shortfall = requiredAmount - currentBalance;
      const airdropAmount = Math.max(shortfall + 10, 50); // Always airdrop at least 50 SOL
      
      logger.warn(`⚠️  Insufficient balance. Need ${requiredAmount.toFixed(4)} SOL, have ${currentBalance.toFixed(4)} SOL`);
      logger.info(`🪂 Requesting ${airdropAmount} SOL airdrop...`);
      
      await this.requestFundingAirdrop(airdropAmount);
      
      // Verify we have enough after airdrop
      const newBalance = await this.checkFundingBalance();
      if (newBalance < requiredAmount) {
        throw new Error(`Still insufficient balance after airdrop. Have ${newBalance.toFixed(4)} SOL, need ${requiredAmount.toFixed(4)} SOL`);
      }
    } else {
      logger.info(`✅ Funding wallet has sufficient balance: ${currentBalance.toFixed(4)} SOL`);
    }
  }

  async airdropToWallet(targetWallet: PublicKey, amount: number): Promise<string> {
    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.fundingPublicKey,
          toPubkey: targetWallet,
          lamports: amount * LAMPORTS_PER_SOL,
        })
      );

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.fundingPublicKey;

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.fundingKeypair],
        { commitment: 'confirmed' }
      );

      return signature;
    } catch (error) {
      logger.error(`Failed to airdrop to wallet ${targetWallet.toBase58()}:`, error);
      throw error;
    }
  }


  async airdropToWallets(wallets: Wallet[], amountPerWallet: number): Promise<void> {
    const totalRequired = wallets.length * amountPerWallet + 1; // +1 for transaction fees
    const batchSize = 10; // Process 10 wallets at a time
    
    logger.info(`🪂 Starting airdrop to ${wallets.length} wallets...`);
    logger.info(`💰 Amount per wallet: ${amountPerWallet} SOL`);
    logger.info(`💸 Total required: ${totalRequired.toFixed(4)} SOL`);
    
    await this.ensureFundingBalance(totalRequired);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < wallets.length; i += batchSize) {
      const batch = wallets.slice(i, i + batchSize);
      logger.info(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(wallets.length / batchSize)} (${batch.length} wallets)...`);
      
      const batchPromises = batch.map(async (wallet) => {
        try {
          const targetPublicKey = new PublicKey(wallet.publicKey);
          const signature = await this.airdropToWallet(targetPublicKey, amountPerWallet);
          
          logger.info(`✅ Funded wallet ${wallet.publicKey} with ${amountPerWallet} SOL`);
          logger.info(`   Transaction: ${signature}`);
          
          wallet.balance = amountPerWallet;
          wallet.isReady = true;
          
          successCount++;
          return { success: true, wallet: wallet.publicKey, signature };
        } catch (error) {
          logger.error(`❌ Failed to fund wallet ${wallet.publicKey}:`, error);
          failCount++;
          return { success: false, wallet: wallet.publicKey, error: error instanceof Error ? error.message : String(error) };
        }
      });
      
      await Promise.all(batchPromises);
      
      if (i + batchSize < wallets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    logger.info(`🎉 Airdrop completed!`);
    logger.info(`✅ Successful: ${successCount}/${wallets.length}`);
    logger.info(`❌ Failed: ${failCount}/${wallets.length}`);
    
    if (failCount > 0) {
      logger.warn(`⚠️  ${failCount} wallets failed to receive funding`);
    }
  }

  async fundAllWallets(wallets: Wallet[]): Promise<void> {
    const requiredAmount = config.wallet.purchaseAmountSol + config.wallet.gasBufferSol;
    
    logger.info(`💰 Funding ${wallets.length} wallets with ${requiredAmount} SOL each...`);
    
    const walletsNeedingFunding = wallets.filter(w => w.balance < requiredAmount);
    
    if (walletsNeedingFunding.length === 0) {
      logger.info('✅ All wallets already have sufficient balance');
      return;
    }
    
    logger.info(`🔄 ${walletsNeedingFunding.length} wallets need funding...`);
    
    await this.airdropToWallets(walletsNeedingFunding, requiredAmount);
  }

  async quickFundAll(wallets: Wallet[]): Promise<void> {
    const testAmount = 0.1; // 0.1 SOL per wallet for testing
    
    logger.info(`🚀 Quick funding ${wallets.length} wallets with ${testAmount} SOL each...`);
    
    await this.airdropToWallets(wallets, testAmount);
  }

  getFundingInfo(): { publicKey: string; balance: Promise<number> } {
    return {
      publicKey: this.fundingPublicKey.toBase58(),
      balance: this.checkFundingBalance()
    };
  }

  estimateFundingCost(walletCount: number, amountPerWallet: number): number {
    const totalAmount = walletCount * amountPerWallet;
    const transactionFees = Math.ceil(walletCount / 10) * 0.005; // Estimate transaction fees
    const buffer = 1; // 1 SOL buffer
    
    return totalAmount + transactionFees + buffer;
  }
}

export default AirDrop;
