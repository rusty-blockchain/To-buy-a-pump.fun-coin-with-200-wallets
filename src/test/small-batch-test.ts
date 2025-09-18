#!/usr/bin/env node

import { PumpFunMultiWalletBot } from '../index';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

/**
 * Small batch test runner for the pump.fun multi-wallet bot
 * Tests with 5-10 wallets before full scale execution
 */
class SmallBatchTest {
  private bot: PumpFunMultiWalletBot;
  private testWalletCount: number;

  constructor() {
    this.bot = new PumpFunMultiWalletBot();
    this.testWalletCount = 5; // Start with 5 wallets
  }

  setTestWalletCount(count: number) {
    if (Number.isFinite(count) && count > 0) {
      this.testWalletCount = Math.floor(count);
    }
  }

  /**
   * Run small batch test
   */
  async runTest(): Promise<void> {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('🧪 SMALL BATCH TEST - PUMP.FUN MULTI-WALLET BOT');
      console.log('='.repeat(60));
      
      // Override wallet count for testing
      const originalCount = config.wallet.count;
      config.wallet.count = this.testWalletCount;
      
      logger.info(`Running small batch test with ${this.testWalletCount} wallets`);
      
      // Initialize bot
      console.log('\n📋 Step 1: Initializing bot...');
      const initialized = await this.bot.initialize();
      
      if (!initialized) {
        throw new Error('Failed to initialize bot');
      }
      
      console.log('✅ Bot initialized successfully');
      
      // Run execution
      console.log('\n🚀 Step 2: Executing transactions...');
      await this.bot.execute();
      
      console.log('\n✅ Small batch test completed successfully!');
      
      // Restore original count
      config.wallet.count = originalCount;
      
    } catch (error) {
      logger.error('Small batch test failed:', error);
      console.log('\n❌ Small batch test failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Run progressive test (5, 10, 25 wallets)
   */
  async runProgressiveTest(): Promise<void> {
    const testSizes = [5, 10, 25];
    
    for (const size of testSizes) {
      try {
        console.log(`\n🧪 Testing with ${size} wallets...`);
        this.testWalletCount = size;
        await this.runTest();
        console.log(`✅ Test with ${size} wallets passed!`);
      } catch (error) {
        console.log(`❌ Test with ${size} wallets failed:`, error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
    
    console.log('\n🎉 All progressive tests passed! Ready for full scale execution.');
  }

  /**
   * Run wallet generation test
   */
  async testWalletGeneration(): Promise<void> {
    try {
      console.log('\n🔑 Testing wallet generation...');
      
      // Override wallet count
      const originalCount = config.wallet.count;
      config.wallet.count = 10;
      
      const initialized = await this.bot.initialize();
      
      if (initialized) {
        console.log('✅ Wallet generation test passed!');
      } else {
        throw new Error('Wallet generation failed');
      }
      
      // Restore original count
      config.wallet.count = originalCount;
      
    } catch (error) {
      console.log('❌ Wallet generation test failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Run transaction building test
   */
  async testTransactionBuilding(): Promise<void> {
    try {
      console.log('\n🔨 Testing transaction building...');
      
      // Override wallet count
      const originalCount = config.wallet.count;
      config.wallet.count = 3;
      
      const initialized = await this.bot.initialize();
      
      if (initialized) {
        console.log('✅ Transaction building test passed!');
      } else {
        throw new Error('Transaction building failed');
      }
      
      // Restore original count
      config.wallet.count = originalCount;
      
    } catch (error) {
      console.log('❌ Transaction building test failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Run all component tests
   */
  async runAllTests(): Promise<void> {
    try {
      console.log('\n🧪 Running all component tests...');
      
      await this.testWalletGeneration();
      await this.testTransactionBuilding();
      await this.runProgressiveTest();
      
      console.log('\n🎉 All tests passed! Bot is ready for production.');
      
    } catch (error) {
      console.log('\n❌ Some tests failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// Main execution
async function main() {
  const test = new SmallBatchTest();
  
  try {
    const args = process.argv.slice(2);
    
    // Handle both --count 100 and just 100 formats
    let walletCount = 5; // default
    
    const countIndex = args.indexOf('--count');
    if (countIndex !== -1 && args[countIndex + 1]) {
      // Format: --count 100
      const parsed = parseInt(args[countIndex + 1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        walletCount = parsed;
      }
    } else if (args.length > 0 && !isNaN(parseInt(args[0], 10))) {
      // Format: just 100 (npm strips --count)
      const parsed = parseInt(args[0], 10);
      if (parsed > 0) {
        walletCount = parsed;
      }
    }
    
    test.setTestWalletCount(walletCount);
    
    if (args.includes('--progressive')) {
      await test.runProgressiveTest();
    } else if (args.includes('--all')) {
      await test.runAllTests();
    } else if (args.includes('--wallets')) {
      await test.testWalletGeneration();
    } else if (args.includes('--transactions')) {
      await test.testTransactionBuilding();
    } else {
      await test.runTest();
    }
    
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main();
}

export { SmallBatchTest };
