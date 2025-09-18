// Core interfaces for the pump.fun multi-wallet bot

export interface Wallet {
  publicKey: string;
  secretKey: Uint8Array;
  balance: number;
  isReady: boolean;
}

export interface TransactionConfig {
  programId: string;
  tokenAccount: string;
  purchaseAmount: number;
  gasPrice: number;
  priorityFee: number;
  maxRetries: number;
  timeout: number;
}

export interface ExecutionResult {
  success: boolean;
  transactionHashes: Array<{ wallet: string; hash: string }>;
  blockHeight: number;
  blockHash: string;
  executionTime: number;
  successRate: number;
  failedWallets: string[];
  gasUsed: number;
}

export interface BlockInfo {
  slot: number;
  blockhash: string;
  parentSlot: number;
  timestamp: number;
  transactionCount: number;
}

export interface SynchronizationConfig {
  precisionMs: number;
  networkLatency: number;
  blockTime: number;
  bufferTime: number;
}

export interface PumpFunConfig {
  programId: string;
  tokenMint: string;
  bondingCurve: string;
  feeRecipient: string;
  creatorFee: number;
  platformFee: number;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

export interface VerificationResult {
  allInSameBlock: boolean;
  blockHeight: number;
  transactionCount: number;
  successRate: number;
  transactionHashes: Array<{
    wallet: string;
    hash: string;
    confirmed: boolean;
    slot: number | null;
    blockTime: number | null;
  }>;
}
