import dotenv from 'dotenv';
import { Connection, clusterApiUrl } from '@solana/web3.js';

// Load environment variables
dotenv.config();

export const config = {
  // Solana Network Configuration
  network: process.env.SOLANA_NETWORK || 'devnet',
  rpcUrl: process.env.SOLANA_RPC_URL || clusterApiUrl('devnet'),
  wsUrl: process.env.SOLANA_WS_URL || 'wss://api.devnet.solana.com',
  
  // Alternative RPC endpoints for failover
  rpcUrls: [
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', // Try devnet first
    process.env.SOLANA_RPC_URL_2 || clusterApiUrl('testnet'),
    process.env.SOLANA_RPC_URL_3 || 'https://testnet.helius-rpc.com',
    process.env.SOLANA_RPC_URL_4 || 'https://rpc.ankr.com/solana_testnet'
  ],

  // Pump.fun Configuration
  pumpFun: {
    programId: process.env.PUMP_FUN_PROGRAM_ID || '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    tokenAccount: process.env.PUMP_FUN_TOKEN_ACCOUNT || '',
  },

  // Wallet Configuration
  wallet: {
    count: parseInt(process.env.WALLET_COUNT || '100'),
    purchaseAmountSol: parseFloat(process.env.PURCHASE_AMOUNT_SOL || '0.01'),
    gasBufferSol: parseFloat(process.env.GAS_BUFFER_SOL || '0.001'),
  },

  // Funding Wallet Configuration
  funding: {
    privateKey: process.env.FUNDING_WALLET_PRIVATE_KEY || '',
    amountPerWallet: parseFloat(process.env.FUNDING_AMOUNT_PER_WALLET || '0.1'),
  },

  // Execution Configuration
  execution: {
    syncPrecisionMs: parseInt(process.env.SYNC_PRECISION_MS || '1'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    timeoutMs: parseInt(process.env.TIMEOUT_MS || '30000'),
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/pump-fun-bot.log',
  },
};

// Create Solana connection
export const createConnection = (): Connection => {
  return new Connection(config.rpcUrl, {
    commitment: 'confirmed',
    wsEndpoint: config.wsUrl,
  });
};

// Validate configuration
export const validateConfig = (): boolean => {
  const required = [
    'PUMP_FUN_PROGRAM_ID',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    return false;
  }

  return true;
};
