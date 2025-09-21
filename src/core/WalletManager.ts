import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';
import { config, createConnection } from '../utils/config';
import { logger } from '../utils/logger';
import { Wallet } from '../types/interfaces';
import { AirDrop } from './AirDrop';   
import fs from 'fs';
import path from 'path';
import bs58 from 'bs58';

export class WalletManager {
  private wallets: Wallet[] = [];
  private connection: Connection;
  private walletFilePath: string;
  private airDrop: AirDrop;

  constructor() {
    this.connection = createConnection();
    this.walletFilePath = path.join(process.cwd(), 'wallets', 'wallets.json');
    this.airDrop = new AirDrop();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing wallet manager...');

      const walletsDir = path.dirname(this.walletFilePath);
      if (!fs.existsSync(walletsDir)) {
        fs.mkdirSync(walletsDir, { recursive: true });
      }

      if (fs.existsSync(this.walletFilePath)) {
        await this.loadWallets();
        logger.info(`Loaded ${this.wallets.length} existing wallets`);
        
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

      await this.verifyBalances();

      logger.info('Wallet manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize wallet manager:', error);
      throw error;
    }
  }

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

  getWallets(): Wallet[] {
    return this.wallets;
  }

  getReadyWallets(): Wallet[] {
    // Return only the required number of ready wallets based on config
    const readyWallets = this.wallets.filter(w => w.isReady);
    return readyWallets.slice(0, config.wallet.count);
  }

  getWallet(publicKey: string): Wallet | undefined {
    return this.wallets.find(w => w.publicKey === publicKey);
  }

  getWalletCount(): number {
    return this.wallets.length;
  }

  getReadyWalletCount(): number {
    return this.wallets.filter(w => w.isReady).length;
  }

  async fundWallets(): Promise<void> {
    if (config.network !== 'testnet' && config.network !== 'devnet') {
      logger.warn('Funding wallets is only available on testnet/devnet');
      return;
    }

    logger.info('💰 Funding wallets using AirDrop system...');
    
    try {
      await this.airDrop.fundAllWallets(this.wallets);
      
      await this.verifyBalances();
      
      const readyCount = this.wallets.filter(w => w.isReady).length;
      logger.info(`🎉 Funding complete! ${readyCount}/${this.wallets.length} wallets are now ready`);
      
    } catch (error) {
      logger.error('❌ Funding failed:', error);
      throw error;
    }
  }

  async quickFundAll(): Promise<void> {
    if (config.network !== 'testnet' && config.network !== 'devnet') {
      logger.warn('Funding wallets is only available on testnet/devnet');
      return;
    }

    logger.info('🚀 Quick funding all wallets for testing...');
    
    try {
      const requiredWallets = this.wallets.slice(0, config.wallet.count);
      logger.info(`🎯 Funding only ${requiredWallets.length} wallets (as configured)`);
      
      await this.airDrop.quickFundAll(requiredWallets);
      
      await this.verifyBalances();
      
      const readyCount = this.wallets.filter(w => w.isReady).length;
      logger.info(`🎉 Quick funding complete! ${readyCount}/${this.wallets.length} wallets are now ready`);
      
    } catch (error) {
      logger.error('❌ Quick funding failed:', error);
      throw error;
    }
  }

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
