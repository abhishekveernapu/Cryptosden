import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  coinId:    { type: String, required: true, index: true },
  coinName:  String,
  type: {
    type: String,
    enum: ['pump','dump','volume_spike','whale_transfer','isolation_forest','zscore'],
    required: true,
  },
  severity:  { type: String, enum: ['info','warning','critical'], default: 'info' },
  message:   String,
  price:     Number,
  change24h: Number,
  metadata:  mongoose.Schema.Types.Mixed,  // extra context (z-score val, whale amount etc)
  resolved:  { type: Boolean, default: false, index: true },
  notifiedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

alertSchema.index({ coinId: 1, type: 1, resolved: 1 });
alertSchema.index({ createdAt: -1 });

export default mongoose.model('Alert', alertSchema);
