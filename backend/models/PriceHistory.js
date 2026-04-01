import mongoose from 'mongoose';

const priceHistorySchema = new mongoose.Schema({
  coinId:    { type: String, required: true, index: true },
  timestamp: { type: Date,   required: true },
  open:  Number,
  high:  Number,
  low:   Number,
  close: { type: Number, required: true },
  volume:{ type: Number, default: 0 },
  // Computed technical indicators (stored for GRU training)
  rsi14:       Number,
  macd:        Number,
  macdSignal:  Number,
  bbUpper:     Number,
  bbLower:     Number,
  sma20:       Number,
  volumeRatio: Number,
  priceRange:  Number,
}, { timestamps: false });

priceHistorySchema.index({ coinId: 1, timestamp: 1 }, { unique: true });
priceHistorySchema.index({ coinId: 1, timestamp: -1 });

export default mongoose.model('PriceHistory', priceHistorySchema);
