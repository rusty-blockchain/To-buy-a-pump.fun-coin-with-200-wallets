import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';
import { config, createConnection } from '../utils/config';
import { logger } from '../utils/logger';
import { Wallet } from '../types/interfaces';
import fs from 'fs';
import path from 'path';
import bs58 from 'bs58';

export class WalletManager {
  private wallets: Wallet[] = [];
  private connection: Connection;
  private walletFilePath: string;

  constructor() {
    this.connection = createConnection();
    this.walletFilePath = path.join(process.cwd(), 'wallets', 'wallets.json');
  }

  /**
   * Initialize wallet manager and generate/load wallets
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing wallet manager...');

      // Ensure wallets directory exists
      const walletsDir = path.dirname(this.walletFilePath);
      if (!fs.existsSync(walletsDir)) {
        fs.mkdirSync(walletsDir, { recursive: true });
      }

      // Try to load existing wallets, otherwise generate new ones
      if (fs.existsSync(this.walletFilePath)) {
        await this.loadWallets();
        logger.info(`Loaded ${this.wallets.length} existing wallets`);
        
        // If we need more wallets than we have, generate additional ones
        if (this.wallets.length < config.wallet.count) {
          const additionalNeeded = config.wallet.count - this.wallets.length;
          logger.info(`Generating ${additionalNeeded} additional wallets...`);
          
          for (let i = 0; i < additionalNeeded; i++) {
            const keypair = Keypair.generate();
            const wallet: Wallet = {
              publicKey: keypair.publicKey.toBase58(),
              secretKey: keypair.secretKey,
              balance: 0,
              isReady: false
            };
            this.wallets.push(wallet);
          }
          
          await this.saveWallets();
          logger.info(`Generated ${additionalNeeded} additional wallets. Total: ${this.wallets.length}`);
        }
      } else {
        await this.generateWallets();
        await this.saveWallets();
        logger.info(`Generated ${this.wallets.length} new wallets`);
      }

      // Verify wallet balances
      await this.verifyBalances();

      logger.info('Wallet manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize wallet manager:', error);
      throw error;
    }
  }

  /**
   * Generate new wallets
   */
  private async generateWallets(): Promise<void> {
    logger.info(`Generating ${config.wallet.count} wallets...`);
    
    this.wallets = [];
    
    for (let i = 0; i < config.wallet.count; i++) {
      const keypair = Keypair.generate();
      const wallet: Wallet = {
        publicKey: keypair.publicKey.toBase58(),
        secretKey: keypair.secretKey,
        balance: 0,
        isReady: false
      };
      
      this.wallets.push(wallet);
    }
  }

  /**
   * Load wallets from file
   */
  private async loadWallets(): Promise<void> {
    try {
      const data = fs.readFileSync(this.walletFilePath, 'utf8');
      const walletData = JSON.parse(data);
      
      this.wallets = walletData.map((w: any) => ({
        ...w,
        secretKey: new Uint8Array(w.secretKey)
      }));
    } catch (error) {
      logger.error('Failed to load wallets:', error);
      throw error;
    }
  }

  /**
   * Save wallets to file
   */
  private async saveWallets(): Promise<void> {
    try {
      const walletData = this.wallets.map(w => ({
        ...w,
        secretKey: Array.from(w.secretKey)
      }));
      
      fs.writeFileSync(this.walletFilePath, JSON.stringify(walletData, null, 2));
      logger.info('Wallets saved to file');
    } catch (error) {
      logger.error('Failed to save wallets:', error);
      throw error;
    }
  }

  /**
   * Verify wallet balances and readiness
   */
  private async verifyBalances(): Promise<void> {
    logger.info('Verifying wallet balances...');
    
    const requiredBalance = config.wallet.purchaseAmountSol + config.wallet.gasBufferSol;
    
    for (const wallet of this.wallets) {
      try {
        const publicKey = new PublicKey(wallet.publicKey);
        const balance = await this.connection.getBalance(publicKey);
        wallet.balance = balance / LAMPORTS_PER_SOL;
        wallet.isReady = wallet.balance >= requiredBalance;
        
        if (!wallet.isReady) {
          logger.warn(`Wallet ${wallet.publicKey} has insufficient balance: ${wallet.balance} SOL (required: ${requiredBalance} SOL)`);
        }
      } catch (error) {
        logger.error(`Failed to check balance for wallet ${wallet.publicKey}:`, error);
        wallet.isReady = false;
      }
    }
    
    const readyWallets = this.wallets.filter(w => w.isReady).length;
    logger.info(`${readyWallets}/${this.wallets.length} wallets are ready for execution`);
  }

  /**
   * Get all wallets
   */
  getWallets(): Wallet[] {
    return this.wallets;
  }

  /**
   * Get ready wallets only
   */
  getReadyWallets(): Wallet[] {
    return this.wallets.filter(w => w.isReady);
  }

  /**
   * Get wallet by public key
   */
  getWallet(publicKey: string): Wallet | undefined {
    return this.wallets.find(w => w.publicKey === publicKey);
  }

  /**
   * Get wallet count
   */
  getWalletCount(): number {
    return this.wallets.length;
  }

  /**
   * Get ready wallet count
   */
  getReadyWalletCount(): number {
    return this.wallets.filter(w => w.isReady).length;
  }

  /**
   * Fund wallets using funding wallet (for testnet)
   */
  async fundWallets(): Promise<void> {
      if (config.network !== 'testnet' && config.network !== 'devnet') {
        logger.warn('Funding wallets is only available on testnet/devnet');
        return;
      }

    // Check if funding wallet is configured
    if (!config.funding.privateKey) {
      logger.error('❌ FUNDING_WALLET_PRIVATE_KEY not configured in .env file');
      logger.error('Please add your funding wallet private key to .env file:');
      logger.error('FUNDING_WALLET_PRIVATE_KEY=your_private_key_here');
      throw new Error('Funding wallet not configured');
    }

    logger.info('💰 Funding wallets using your funding wallet...');
    
    const fundingAmount = config.funding.amountPerWallet;
    const unreadyWallets = this.wallets.filter(w => !w.isReady);
    
    logger.info(`Funding ${unreadyWallets.length} unready wallets with ${fundingAmount} SOL each...`);
    
    try {
      // Create funding wallet keypair
      let privateKeyArray: number[];
      
      try {
        // Try to parse as JSON array first
        privateKeyArray = JSON.parse(config.funding.privateKey);
      } catch (jsonError) {
        try {
          // Try to parse as base58 string
          privateKeyArray = Array.from(bs58.decode(config.funding.privateKey));
        } catch (base58Error) {
          // Try to parse as comma-separated string
          privateKeyArray = config.funding.privateKey.split(',').map(n => parseInt(n.trim()));
        }
      }
      
      const fundingKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      const fundingPublicKey = fundingKeypair.publicKey;
      
      // Check funding wallet balance
      let fundingBalance = await this.connection.getBalance(fundingPublicKey);
      let fundingBalanceSol = fundingBalance / LAMPORTS_PER_SOL;
      const totalRequired = unreadyWallets.length * fundingAmount;
      
      logger.info(`💳 Funding wallet: ${fundingPublicKey.toBase58()}`);
      logger.info(`💰 Funding wallet balance: ${fundingBalanceSol.toFixed(4)} SOL`);
      logger.info(`💸 Total required: ${totalRequired.toFixed(4)} SOL`);
      
      // If funding wallet has insufficient balance, try to airdrop 10 SOL
      if (fundingBalanceSol < totalRequired + 0.01) { // +0.01 for transaction fees
        logger.warn('⚠️  Funding wallet has insufficient balance');
        logger.info('🪂 Attempting to airdrop 10 SOL to funding wallet...');
        
        try {
          const airdropAmount = 10; // 10 SOL
          const airdropSignature = await this.connection.requestAirdrop(
            fundingPublicKey,
            airdropAmount * LAMPORTS_PER_SOL
          );
          
          logger.info(`🪂 Airdrop transaction: ${airdropSignature}`);
          logger.info('⏳ Waiting for airdrop confirmation...');
          
          // Wait for confirmation
          await this.connection.confirmTransaction(airdropSignature);
          
          // Check new balance
          fundingBalance = await this.connection.getBalance(fundingPublicKey);
          fundingBalanceSol = fundingBalance / LAMPORTS_PER_SOL;
          
          logger.info(`✅ Airdrop successful! New balance: ${fundingBalanceSol.toFixed(4)} SOL`);
          
          // Check if still insufficient after airdrop
          if (fundingBalanceSol < totalRequired + 0.01) {
            logger.error('❌ STILL INSUFFICIENT BALANCE AFTER AIRDROP!');
            logger.error(`Required: ${(totalRequired + 0.01).toFixed(4)} SOL`);
            logger.error(`Available: ${fundingBalanceSol.toFixed(4)} SOL`);
            logger.error(`Missing: ${(totalRequired + 0.01 - fundingBalanceSol).toFixed(4)} SOL`);
            logger.error('💡 Try requesting more SOL from https://faucet.solana.com');
            throw new Error('Insufficient funding wallet balance after airdrop');
          }
          
        } catch (airdropError) {
          logger.error('❌ Airdrop failed:', airdropError);
          logger.error('💡 Please manually fund your wallet from https://faucet.solana.com');
          logger.error(`Required: ${(totalRequired + 0.01).toFixed(4)} SOL`);
          throw new Error('Airdrop failed and insufficient funding wallet balance');
        }
      }
      
      logger.info('✅ Funding wallet has sufficient balance');
      
      // Fund each wallet
      for (let i = 0; i < unreadyWallets.length; i++) {
        const wallet = unreadyWallets[i];
        try {
          const walletPublicKey = new PublicKey(wallet.publicKey);
          
          // Create transfer transaction
          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: fundingPublicKey,
              toPubkey: walletPublicKey,
              lamports: fundingAmount * LAMPORTS_PER_SOL,
            })
          );
          
          // Get recent blockhash
          const { blockhash } = await this.connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = fundingPublicKey;
          
          // Sign and send transaction
          transaction.sign(fundingKeypair);
          const signature = await this.connection.sendRawTransaction(transaction.serialize());
          
          // Wait for confirmation
          await this.connection.confirmTransaction(signature);
          
          logger.info(`✅ Funded wallet ${wallet.publicKey} with ${fundingAmount} SOL`);
          logger.info(`   Transaction: ${signature}`);
          
          // Update balance
          const balance = await this.connection.getBalance(walletPublicKey);
          wallet.balance = balance / LAMPORTS_PER_SOL;
          
        } catch (error) {
          logger.error(`❌ Failed to fund wallet ${wallet.publicKey}:`, error);
        }
        
        // Small delay between transactions
        if (i < unreadyWallets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Re-verify balances
      await this.verifyBalances();
      
      const readyCount = this.wallets.filter(w => w.isReady).length;
      logger.info(`🎉 Funding complete! ${readyCount}/${this.wallets.length} wallets are now ready`);
      
    } catch (error) {
      logger.error('❌ Funding failed:', error);
      throw error;
    }
  }

  /**
   * Get wallet statistics
   */
  getWalletStats(): {
    total: number;
    ready: number;
    totalBalance: number;
    averageBalance: number;
  } {
    const total = this.wallets.length;
    const ready = this.wallets.filter(w => w.isReady).length;
    const totalBalance = this.wallets.reduce((sum, w) => sum + w.balance, 0);
    const averageBalance = total > 0 ? totalBalance / total : 0;
    
    return {
      total,
      ready,
      totalBalance,
      averageBalance
    };
  }
}
