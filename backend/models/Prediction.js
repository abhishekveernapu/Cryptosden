import mongoose from 'mongoose';

// ── Reusable sub-schema for a price in all 4 currencies ───────────────────
const currencySchema = new mongoose.Schema({
  usd: { type: Number, default: 0 },
  inr: { type: Number, default: 0 },
  eur: { type: Number, default: 0 },
  gbp: { type: Number, default: 0 },
}, { _id: false });

// ── One prediction horizon (day1 / day7 / day14 / day30) ─────────────────
const horizonSchema = new mongoose.Schema({
  price:        { type: currencySchema, default: () => ({}) },
  low95:        { type: currencySchema, default: () => ({}) },  // 95% CI lower
  high95:       { type: currencySchema, default: () => ({}) },  // 95% CI upper
  currentPrice: { type: currencySchema, default: () => ({}) },  // snapshot at train time
  change:       Number,                                          // % change vs currentPrice (USD basis)
  direction:    { type: String, enum: ['Bullish', 'Bearish', 'Neutral'] },
}, { _id: false });

// ── Root prediction document ──────────────────────────────────────────────
const predictionSchema = new mongoose.Schema({
  coinId: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
  },

  predictions: {
    day1:  { type: horizonSchema, default: () => ({}) },
    day7:  { type: horizonSchema, default: () => ({}) },
    day14: { type: horizonSchema, default: () => ({}) },
    day30: { type: horizonSchema, default: () => ({}) },
  },

  // ── Top-level current price in all currencies ─────────────────────────
  currentPrice: { type: currencySchema, default: () => ({}) },

  // ── Exchange rates used at training time (for audit / re-conversion) ──
  ratesAt: {
    type:    currencySchema,
    default: () => ({ usd: 1, inr: 83.5, eur: 0.92, gbp: 0.79 }),
  },

  trainedAt:  Date,
  dataPoints: Number,
  modelLoss:  Number,
  mape:       Number,   // Mean Absolute Percentage Error

}, { timestamps: true });

export default mongoose.model('Prediction', predictionSchema);
