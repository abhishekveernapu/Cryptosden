import Crypto       from '../models/Crypto.js';
import PriceHistory from '../models/PriceHistory.js';
import Alert        from '../models/Alert.js';
import User         from '../models/User.js';
import { zScore, mean, stdDev, clamp } from '../utils/mathUtils.js';
import { sendAlertEmail, buildAlertEmailHtml } from '../config/mailer.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────
// METHOD A — Z-Score Detection
// ─────────────────────────────────────────────────────────────────────────
const detectZScoreAnomalies = async (coin) => {
  const alerts = [];

  const history = await PriceHistory.find({ coinId: coin.coinId })
    .sort({ timestamp: -1 })
    .limit(31)
    .lean();

  if (history.length < 10) return alerts;

  const recent  = history[0];
  const past30  = history.slice(1);

  // Volume Z-score
  const volumes   = past30.map(h => h.volume || 0);
  const volZ      = zScore(recent.volume || 0, volumes);
  if (Math.abs(volZ) >= 2.5) {
    alerts.push({
      type:     'zscore',
      severity: Math.abs(volZ) >= 3.5 ? 'critical' : 'warning',
      message:  `${coin.coinName} volume spike: Z-score ${volZ.toFixed(2)}`,
      metadata: { zScore: volZ, metric: 'volume' },
    });
  }

  // Price change Z-score
  const changes    = past30.map(h => h.close && past30[0]?.close
    ? ((h.close - past30[0].close) / past30[0].close) * 100 : 0
  );
  const priceZ     = zScore(coin.change24h || 0, changes);
  if (Math.abs(priceZ) >= 2.5) {
    alerts.push({
      type:     'pump_dump' in coin ? 'dump' : coin.change24h > 0 ? 'pump' : 'dump',
      severity: Math.abs(priceZ) >= 3.5 ? 'critical' : 'warning',
      message:  `${coin.coinName} price anomaly: Z-score ${priceZ.toFixed(2)}`,
      metadata: { zScore: priceZ, metric: 'price_change', change24h: coin.change24h },
    });
  }

  return alerts;
};

// ─────────────────────────────────────────────────────────────────────────
// METHOD B — Isolation Forest (Pure JS Implementation)
// ─────────────────────────────────────────────────────────────────────────
class IsolationTree {
  constructor(maxDepth) {
    this.maxDepth = maxDepth;
    this.root     = null;
  }

  fit(data, depth = 0) {
    if (data.length <= 1 || depth >= this.maxDepth) {
      return { isLeaf: true, size: data.length };
    }

    const featureIdx = Math.floor(Math.random() * data[0].length);
    const values     = data.map(d => d[featureIdx]);
    const minVal     = Math.min(...values);
    const maxVal     = Math.max(...values);

    if (minVal === maxVal) {
      return { isLeaf: true, size: data.length };
    }

    const splitVal = minVal + Math.random() * (maxVal - minVal);
    const left     = data.filter(d => d[featureIdx] < splitVal);
    const right    = data.filter(d => d[featureIdx] >= splitVal);

    return {
      isLeaf:     false,
      featureIdx, splitVal,
      left:  this.fit(left,  depth + 1),
      right: this.fit(right, depth + 1),
    };
  }

  pathLength(point, node = this.root, depth = 0) {
    if (!node || node.isLeaf) {
      return depth + this._avgPathLength(node?.size || 1);
    }
    if (point[node.featureIdx] < node.splitVal) {
      return this.pathLength(point, node.left,  depth + 1);
    }
    return this.pathLength(point, node.right, depth + 1);
  }

  _avgPathLength(n) {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}

class IsolationForest {
  constructor(nTrees = 100, sampleSize = 256, contamination = 0.05) {
    this.nTrees        = nTrees;
    this.sampleSize    = sampleSize;
    this.contamination = contamination;
    this.trees         = [];
    this.threshold     = 0;
  }

  fit(data) {
    const maxDepth = Math.ceil(Math.log2(this.sampleSize));
    this.trees     = [];

    for (let i = 0; i < this.nTrees; i++) {
      const sample = [];
      for (let j = 0; j < Math.min(this.sampleSize, data.length); j++) {
        sample.push(data[Math.floor(Math.random() * data.length)]);
      }
      const tree  = new IsolationTree(maxDepth);
      tree.root   = tree.fit(sample);
      this.trees.push(tree);
    }

    const scores    = data.map(d => this._anomalyScore(d, data.length));
    scores.sort((a, b) => b - a);
    this.threshold  = scores[Math.floor(this.contamination * scores.length)] || 0.6;
    return this;
  }

  _avgPathLength(n) {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }

  _anomalyScore(point, n) {
    const avgPath = this.trees.reduce((s, t) =>
      s + t.pathLength(point, t.root), 0) / this.trees.length;
    return Math.pow(2, -avgPath / this._avgPathLength(n));
  }

  predict(point, n) {
    const score = this._anomalyScore(point, n);
    return { score, isAnomaly: score > this.threshold };
  }
}

const detectIsolationForestAnomalies = async (coins) => {
  const alerts = [];

  // Build feature matrix: [price_change%, volume_change%, volatility]
  const matrix = coins.map(c => [
    c.change24h         || 0,
    c['volume24h']?.usd  || 0,
    Math.abs(c.change24h || 0),
  ]);

  if (matrix.length < 20) return alerts;

  // Normalize features
  const normMatrix = matrix[0].map((_, fi) => {
    const col = matrix.map(r => r[fi]);
    const m   = mean(col);
    const s   = stdDev(col) || 1;
    return col.map(v => (v - m) / s);
  });

  const normalizedRows = matrix.map((_, i) =>
    normMatrix.map(col => col[i])
  );

  const forest = new IsolationForest(100, 256, 0.05);
  forest.fit(normalizedRows);

  coins.forEach((coin, i) => {
    const { score, isAnomaly } = forest.predict(normalizedRows[i], normalizedRows.length);
    if (isAnomaly && score > 0.65) {
      alerts.push({
        coinId:   coin.coinId,
        coinName: coin.coinName,
        type:     'isolation_forest',
        severity: score > 0.8 ? 'critical' : 'warning',
        message:  `${coin.coinName} multi-dimensional anomaly detected (score: ${score.toFixed(2)})`,
        price:    coin.price?.usd,
        change24h:coin.change24h,
        metadata: { isolationScore: score, features: matrix[i] },
      });
    }
  });

  return alerts;
};

// ─────────────────────────────────────────────────────────────────────────
// METHOD C — Whale Transfer Monitoring (BTC blockchain.info)
// ─────────────────────────────────────────────────────────────────────────
const detectWhaleAlerts = async () => {
  const alerts = [];
  try {
    const res  = await fetch(
      'https://blockchain.info/unconfirmed-transactions?format=json&limit=100'
    );
    if (!res.ok) return alerts;

    const data = await res.json();
    const txs  = data.txs || [];

    const SATOSHI_TO_BTC = 1e8;

    txs.forEach(tx => {
      const totalBTC = (tx.out?.reduce((s, o) => s + (o.value || 0), 0) || 0) / SATOSHI_TO_BTC;

      if (totalBTC >= 100) {
        alerts.push({
          coinId:   'bitcoin',
          coinName: 'Bitcoin',
          type:     'whale_transfer',
          severity: totalBTC >= 500 ? 'critical' : 'warning',
          message:  `🐳 Whale transfer: ${totalBTC.toFixed(0)} BTC (${totalBTC >= 500 ? 'CRITICAL' : 'WARNING'})`,
          price:    null,
          change24h:null,
          metadata: { btcAmount: totalBTC, txHash: tx.hash },
        });
      }
    });
  } catch (err) {
    console.error(' Whale detection error:', err.message);
  }

  return alerts.slice(0, 5);  // max 5 whale alerts per run
};

// ─────────────────────────────────────────────────────────────────────────
// NOTIFY users whose wishlist includes the affected coin
// ─────────────────────────────────────────────────────────────────────────
const notifyWishlistUsers = async (alert, io) => {
  try {
    const users = await User.find({
      wishlist:     alert.coinId,
      emailAlerts:  true,
    }).select('email username wishlist').lean();

    for (const user of users) {
      // Socket notification
      if (io) {
        io.to(`user:${user._id}`).emit('notification', {
          coinId:   alert.coinId,
          coinName: alert.coinName,
          type:     alert.type,
          severity: alert.severity,
          message:  alert.message,
        });
      }

      // Email notification
      await sendAlertEmail(
        user.email,
        `🚨 CryptosDen Alert: ${alert.coinName}`,
        buildAlertEmailHtml(
          alert.coinName,
          alert.type,
          alert.change24h,
          alert.price,
          alert.message
        )
      );
    }
  } catch (err) {
    console.error(' Notify users error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// MAIN — Run all 3 methods
// ─────────────────────────────────────────────────────────────────────────
export const runAnomalyDetection = async (io) => {
  console.log(' Running anomaly detection...');

  const coins = await Crypto.find({}).lean();
  let totalAlerts = 0;

  // Method B — Isolation Forest (whole market at once)
  const ifAlerts = await detectIsolationForestAnomalies(coins);
  for (const alertData of ifAlerts) {
    const saved = await Alert.findOneAndUpdate(
      { coinId: alertData.coinId, type: alertData.type, resolved: false },
      { ...alertData, resolved: false },
      { upsert: true, new: true }
    );
    await notifyWishlistUsers(saved, io);
    totalAlerts++;
  }

  // Methods A & C — per coin
  for (const coin of coins) {
    // Method A — Z-Score
    const zAlerts = await detectZScoreAnomalies(coin);
    for (const alertData of zAlerts) {
      const saved = await Alert.findOneAndUpdate(
        { coinId: coin.coinId, type: alertData.type, resolved: false },
        {
          coinId:   coin.coinId,
          coinName: coin.coinName,
          price:    coin.price?.usd,
          change24h:coin.change24h,
          ...alertData,
          resolved: false,
        },
        { upsert: true, new: true }
      );
      await notifyWishlistUsers(saved, io);
      totalAlerts++;
    }
  }

  // Method C — Whale transfers (BTC only)
  const whaleAlerts = await detectWhaleAlerts();
  for (const alertData of whaleAlerts) {
    const saved = await Alert.findOneAndUpdate(
      { 'metadata.txHash': alertData.metadata?.txHash, type: 'whale_transfer' },
      { ...alertData, resolved: false },
      { upsert: true, new: true }
    );
    await notifyWishlistUsers(saved, io);
    totalAlerts++;
  }

  console.log(` Anomaly scan complete — ${totalAlerts} alerts`);
  return totalAlerts;
};
