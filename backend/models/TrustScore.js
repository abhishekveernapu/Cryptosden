import mongoose from 'mongoose';

const trustScoreSchema = new mongoose.Schema({
  coinId: { type: String, required: true, unique: true, index: true },
  score:  { type: Number, min: 0, max: 100 },
  label:  {
    type: String,
    enum: ['Very Low Trust','Low Trust','Neutral','High Trust','Very High Trust'],
  },
  breakdown: {
    fearGreed:     Number,  // 0-100
    marketHealth:  Number,  // 0-100
    trending:      Number,  // 0-100
    coinPaprika:   Number,  // 0-100
    onChain:       Number,  // 0-100
  },
  mlAdjustment: Number,  // bonus/penalty from GRU + anomaly
  computedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('TrustScore', trustScoreSchema);
