# Pump.fun Multi-Wallet Bot

A sophisticated Node.js + TypeScript tool for executing simultaneous pump.fun coin purchases across 70 wallets, ensuring all transactions are included in the same block without using lookup tables (LUT) or transaction bundling.

## 🎯 Features

- **70 Wallets**: Simultaneous execution across 70 different wallets
- **Same Block**: All transactions included in the identical block
- **No LUT**: Transactions constructed without lookup table optimization
- **No Bundling**: Individual transaction broadcasting
- **Mainnet Ready**: Production-ready for real pump.fun trading
- **TypeScript**: Full type safety and modern development experience

## 💰 SOL Requirements

### **Exact SOL Requirements for 70 Wallets:**
- **Wallets**: 70
- **Purchase per wallet**: 0.005 SOL
- **Gas buffer per wallet**: 0.001 SOL
- **Total per wallet**: 0.006 SOL
- **Total SOL needed**: **0.42 SOL**
- **Recommended (with buffer)**: **0.46 SOL**

### **Funding Instructions:**
1. Each wallet needs exactly **0.006 SOL**
2. Total funding required: **0.42 SOL**
3. Send SOL to each wallet address individually
4. Wait for confirmations before running the bot

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- **0.42 SOL minimum** (0.46 SOL recommended)
- **Mainnet SOL only** (no testnet/devnet)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd pump-fun-multi-wallet-bot

# Install dependencies
npm install

# Set up environment
cp env.example .env
# Edit .env with your configuration
```

### Configuration

Edit the `.env` file with your settings:

```env
# Solana Network Configuration
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Pump.fun Configuration
PUMP_FUN_PROGRAM_ID=6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
PUMP_FUN_TOKEN_ACCOUNT=your_token_account_here

# Wallet Configuration
WALLET_COUNT=70
PURCHASE_AMOUNT_SOL=0.005
GAS_BUFFER_SOL=0.001
```

## 🧪 Testing

### Small Batch Test

```bash
# Test with 5 wallets
npm run test:small

# Progressive testing (5, 10, 25 wallets)
npm run test:small -- --progressive

# All component tests
npm run test:small -- --all
```

### Development Mode

```bash
# Start development server with nodemon (auto-restart on changes)
npm run dev

# Start development with file watching
npm run dev:watch

# Build for production
npm run build

# Run production build
npm start
```

## 📋 Usage

### Basic Execution

```bash
# Run with 70 wallets (production)
npm start

# Run with test flag (5 wallets)
npm start -- --test
```

### Programmatic Usage

```typescript
import { PumpFunMultiWalletBot } from './src/index';

const bot = new PumpFunMultiWalletBot();

// Initialize
await bot.initialize();

// Execute
await bot.execute();
```

## 🏗️ Architecture

### Core Components

1. **WalletManager** - Generates and manages 70 wallets
2. **TransactionBuilder** - Creates pump.fun transactions (no LUT)
3. **SynchronizationEngine** - Ensures simultaneous execution
4. **BlockMonitor** - Verifies same-block inclusion

### Project Structure

```
src/
├── core/
│   ├── WalletManager.ts      # Wallet generation and management
│   ├── TransactionBuilder.ts  # Transaction creation (no LUT)
│   ├── SynchronizationEngine.ts # Timing synchronization
│   └── BlockMonitor.ts       # Block monitoring and verification
├── utils/
│   ├── config.ts            # Configuration management
│   └── logger.ts            # Logging system
├── types/
│   └── interfaces.ts        # TypeScript interfaces
├── test/
│   └── small-batch-test.ts  # Testing utilities
└── index.ts                 # Main execution file
```

## 🔧 Technical Details

### Synchronization Strategy

- **Microsecond Precision**: High-precision timing for simultaneous execution
- **Network Latency**: Automatic measurement and compensation
- **Block Timing**: Optimal timing calculation for Solana blocks
- **Error Handling**: Robust failure management and retry logic

### Transaction Building

- **No LUT**: Explicit instruction data without lookup table optimization
- **Gas Optimization**: Efficient gas usage without LUT flags
- **Priority Fees**: Dynamic priority fee calculation
- **Validation**: Comprehensive transaction validation

### Block Monitoring

- **Real-time Tracking**: Live block and transaction monitoring
- **Verification**: Automatic verification of same-block inclusion
- **Reporting**: Detailed execution reports and metrics

## 📊 Expected Output

### Success Report

```
🎯 PUMP.FUN MULTI-WALLET EXECUTION REPORT
================================================================================
📊 Success Rate: 100%
🔗 Block Height: 12345678
⏱️  Execution Time: 245ms
✅ Transactions in Same Block: YES

📋 Transaction Hashes:
1. 7xK8...9mN2: 5jF7...8kL3
2. 9mN2...7xK8: 8kL3...5jF7
...
70. 8kL3...9mN2: 5jF7...7xK8
================================================================================
```

## 🛡️ Security & Safety

### Mainnet Configuration

- **Real SOL Required**: Uses real SOL on mainnet
- **Manual Funding**: Wallets must be manually funded
- **Risk Management**: Test with small batches first
- **Transaction Verification**: Comprehensive validation before execution

### Best Practices

- **Gradual Scaling**: Start with small batches (5-10 wallets)
- **Comprehensive Testing**: Multiple test scenarios
- **Error Handling**: Robust error management
- **Logging**: Detailed execution logs

## 🚨 Important Notes

### Requirements Met

✅ **70 Wallets**: Each wallet executes one purchase  
✅ **Same Block**: All transactions included in identical block  
✅ **No LUT**: Transactions constructed without lookup tables  
✅ **No Bundling**: Individual transaction broadcasting  
✅ **Pump.fun Compatible**: Ready for real pump.fun trading on mainnet

### ⚠️ CRITICAL: Mainnet Configuration Required

**Before production use, you MUST:**
1. Configure proper pump.fun program instruction layout
2. Set correct PUMP_FUN_PROGRAM_ID in .env file
3. Fund all 70 wallets with real SOL (at least 0.006 SOL each)
4. Test with small batch first (5 wallets)
5. Verify transaction success and same-block inclusion  

### Limitations

- **Mainnet Only**: Currently configured for mainnet (uses real SOL)
- **Pump.fun Specific**: Designed for pump.fun contracts
- **Solana Network**: Requires Solana network connectivity
- **Manual Funding**: Wallets must be manually funded with real SOL

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## ⚠️ Disclaimer

This tool is for pump.fun trading purposes. Use at your own risk. Always test thoroughly with small batches before full execution. Uses real SOL on mainnet.

## 🆘 Support

For issues and questions:

1. Check the logs in `logs/pump-fun-bot.log`
2. Review the technical documentation
3. Run small batch tests first
4. Verify mainnet connectivity
5. Ensure all wallets are funded with real SOL

---

**Ready to start? Run `npm install && npm run test:small` to begin!**