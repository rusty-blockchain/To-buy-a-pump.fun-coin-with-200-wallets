#!/usr/bin/env node

/**
 * Setup Funding Wallet Script
 * 
 * This script helps you set up your funding wallet for the pump.fun bot.
 * Run: node setup-funding-wallet.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 PUMP.FUN BOT - FUNDING WALLET SETUP');
console.log('=====================================\n');

console.log('📋 INSTRUCTIONS:');
console.log('1. Copy your wallet private key from Phantom, Solflare, or other Solana wallet');
console.log('2. Use ONE of these formats in your .env file:\n');

console.log('📝 FORMAT OPTIONS FOR .env FILE:');
console.log('');
console.log('Option 1 - JSON Array:');
console.log('FUNDING_WALLET_PRIVATE_KEY=[123,45,67,89,12,34,56,78,...]');
console.log('');
console.log('Option 2 - Base58 String:');
console.log('FUNDING_WALLET_PRIVATE_KEY=5Kb8kLf9zgWQnogidDA76MzPL6Ts...');
console.log('');
console.log('Option 3 - Comma Separated:');
console.log('FUNDING_WALLET_PRIVATE_KEY=123,45,67,89,12,34,56,78,...');
console.log('');
console.log('FUNDING_AMOUNT_PER_WALLET=0.1\n');

console.log('💰 FUNDING REQUIREMENTS:');
console.log('- Each test wallet needs: 0.1 SOL');
console.log('- For 5 wallets: 0.5 SOL + 0.01 SOL fees = 0.51 SOL minimum');
console.log('- For 100 wallets: 10 SOL + 0.1 SOL fees = 10.1 SOL minimum\n');

console.log('⚠️  IMPORTANT NOTES:');
console.log('- Only use TESTNET wallets for testing');
console.log('- Never share your private key with anyone');
console.log('- Make sure your funding wallet has enough SOL\n');

console.log('🚀 After adding your private key to .env, run:');
console.log('npm run test:small\n');

// Check if .env exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file found');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('FUNDING_WALLET_PRIVATE_KEY=your_funding_wallet_private_key_here')) {
    console.log('⚠️  Please update FUNDING_WALLET_PRIVATE_KEY in .env file');
  } else if (envContent.includes('FUNDING_WALLET_PRIVATE_KEY=')) {
    console.log('✅ FUNDING_WALLET_PRIVATE_KEY is configured');
  }
} else {
  console.log('❌ .env file not found');
  console.log('Please copy env.example to .env and configure your funding wallet');
}
