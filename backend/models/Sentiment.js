import mongoose from 'mongoose';

const sentimentSchema = new mongoose.Schema({
  coinId: { type: String, required: true, unique: true, index: true },

  eVI: {
    type:    Number,
    min:     0,
    max:     100,
    default: 50,
  },

  label: {
    type:    String,
    enum:    ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'],
    default: 'Neutral',
  },

  // ── Weighted breakdown (total = 100%) ────────────────────────
  breakdown: {
    communityVotes: { type: Number, default: 50 },  // CryptoPanic votes  40%
    twitterMood:    { type: Number, default: 50 },  // CoinPaprika Twitter 25%
    newsTone:       { type: Number, default: 50 },  // Headline tone       20%
    fearGreed:      { type: Number, default: 50 },  // Fear & Greed index  15%
  },

  // ── Real Alternative.me Fear & Greed ─────────────────────────
  fearGreedValue: { type: Number, min: 0, max: 100, default: 50 },
  fearGreedLabel: {
    type:    String,
    enum:    ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'],
    default: 'Neutral',
  },

  // ── News metadata ─────────────────────────────────────────────
  meta: {
    newsCount:    { type: Number, default: 0 },
    bullishVotes: { type: Number, default: 0 },
    bearishVotes: { type: Number, default: 0 },
  },

  computedAt: { type: Date, default: Date.now },

}, { timestamps: true });

export default mongoose.model('Sentiment', sentimentSchema);
