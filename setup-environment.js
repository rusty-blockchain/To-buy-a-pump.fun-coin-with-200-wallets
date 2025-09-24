#!/usr/bin/env node

/**
 * Environment Setup Script for Pump.fun Multi-Wallet Bot
 * 
 * This script helps you set up your environment for the pump.fun bot.
 * Run: node setup-environment.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 PUMP.FUN MULTI-WALLET BOT - ENVIRONMENT SETUP');
console.log('================================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from template...');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created');
  } else {
    console.log('❌ env.example not found');
    process.exit(1);
  }
} else {
  console.log('✅ .env file already exists');
}

console.log('\n📋 SETUP REQUIREMENTS:');
console.log('======================');
console.log('1. You need a Solana wallet with at least 0.5 SOL on MAINNET');
console.log('2. The bot will create 70 wallets and you must fund them manually');
console.log('3. All 70 transactions will be sent simultaneously');
console.log('4. Transactions will NOT use LUTs or bundles (as requested)');
console.log('5. All transactions should land in the same block');
console.log('6. ⚠️  WARNING: This uses REAL SOL on MAINNET!');

console.log('\n💰 FUNDING WALLET SETUP:');
console.log('========================');
console.log('⚠️  IMPORTANT: On MAINNET, you must manually fund each wallet!');
console.log('');
console.log('Option 1 - Use existing MAINNET wallet:');
console.log('1. Get your wallet private key from Phantom, Solflare, etc.');
console.log('2. Add it to the .env file: FUNDING_WALLET_PRIVATE_KEY=your_key_here');
console.log('3. Fund each of the 70 wallets with exactly 0.006 SOL each');
console.log('');
console.log('Option 2 - Create new MAINNET wallet:');
console.log('1. Install Solana CLI: https://docs.solana.com/cli/install-solana-cli-tools');
console.log('2. Create wallet: solana-keygen new --outfile ~/my-mainnet-wallet.json');
console.log('3. Set mainnet: solana config set --url https://api.mainnet-beta.solana.com');
console.log('4. Fund with real SOL from an exchange or another wallet');
console.log('5. Copy private key from wallet file to .env');

console.log('\n🔧 ENVIRONMENT CONFIGURATION:');
console.log('==============================');

// Check current .env configuration
const envContent = fs.readFileSync(envPath, 'utf8');

if (envContent.includes('FUNDING_WALLET_PRIVATE_KEY=your_funding_wallet_private_key_here')) {
  console.log('❌ FUNDING_WALLET_PRIVATE_KEY needs to be configured');
  console.log('   Please edit .env file and add your wallet private key');
} else if (envContent.includes('FUNDING_WALLET_PRIVATE_KEY=')) {
  console.log('✅ FUNDING_WALLET_PRIVATE_KEY is configured');
} else {
  console.log('❌ FUNDING_WALLET_PRIVATE_KEY not found in .env');
}

console.log('\n📊 WALLET REQUIREMENTS:');
console.log('=======================');
console.log('• 70 wallets will be created');
console.log('• Each wallet needs: 0.006 SOL for funding');
console.log('• Total required: 0.42 SOL minimum');
console.log('• Recommended funding wallet balance: 0.5 SOL');
console.log('• ⚠️  WARNING: This uses REAL SOL on MAINNET!');

console.log('\n🎯 EXECUTION FLOW:');
console.log('==================');
console.log('1. Check funding wallet balance');
console.log('2. Create 70 wallets');
console.log('3. Manually fund each wallet with 0.006 SOL (MAINNET)');
console.log('4. Prepare 70 pump.fun transactions (no LUTs)');
console.log('5. Send all transactions simultaneously');
console.log('6. Verify all transactions land in same block');
console.log('7. ⚠️  WARNING: Uses REAL SOL and REAL funds!');

console.log('\n🚀 READY TO RUN:');
console.log('================');
console.log('After configuring FUNDING_WALLET_PRIVATE_KEY in .env:');
console.log('');
console.log('For small test (5 wallets):');
console.log('  npm run test:small');
console.log('');
console.log('For full execution (70 wallets):');
console.log('  npm run dev');
console.log('');

console.log('⚠️  IMPORTANT NOTES:');
console.log('===================');
console.log('• This bot is now configured for SOLANA MAINNET');
console.log('• ⚠️  WARNING: Uses REAL SOL and REAL funds!');
console.log('• All transactions use standard Solana instructions (no LUTs)');
console.log('• Timing is optimized for same-block inclusion');
console.log('• Results may vary based on network conditions');
console.log('• You must manually fund each wallet with real SOL');

console.log('\n📞 SUPPORT:');
console.log('===========');
console.log('If you encounter issues:');
console.log('1. Check your .env configuration');
console.log('2. Ensure you have enough SOL on MAINNET');
console.log('3. Try the small test first: npm run test:small');
console.log('4. Check logs in logs/ directory');
console.log('5. ⚠️  Remember: This uses REAL SOL on MAINNET!');

console.log('\n' + '='.repeat(50));
console.log('Setup complete! Configure your .env file and run the bot.');
console.log('='.repeat(50));
