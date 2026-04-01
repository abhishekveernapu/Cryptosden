import mongoose from 'mongoose';

const currencySchema = new mongoose.Schema({
  usd: Number, inr: Number, eur: Number, gbp: Number,
}, { _id: false });

const priceRangeSchema = new mongoose.Schema({
  high24h: { usd: Number, inr: Number, eur: Number, gbp: Number },
  low24h:  { usd: Number, inr: Number, eur: Number, gbp: Number },
}, { _id: false });

const cryptoSchema = new mongoose.Schema({
  coinId:   { type: String, required: true, unique: true, index: true },
  coinName: { type: String, required: true },
  symbol:   String,
  image:    String,

  // Price (multi-currency)
  price:     currencySchema,
  marketCap: currencySchema,
  volume24h: currencySchema,
  fdv:       currencySchema,   // Fully Diluted Valuation

  // Price range
  priceRange: priceRangeSchema,

  // Market ratios
  mcapToFdv: { type: Number, default: null },

  // Supply
  circulatingSupply: { type: Number, default: 0 },
  totalSupply:       { type: Number, default: null },
  maxSupply:         { type: Number, default: null },
  totalTreasury:     { type: Number, default: 0 },

  // Price changes (%)
  change1h:  Number,
  change24h: Number,
  change7d:  Number,
  change14d: Number,
  change30d: Number,
  change1y:  Number,

  // Rank
  rank: { type: Number, index: true },

  
  lastSyncedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

cryptoSchema.index({ rank: 1, 'marketCap.usd': -1 });
cryptoSchema.index({ coinName: 'text', symbol: 'text' });

export default mongoose.model('Crypto', cryptoSchema);
