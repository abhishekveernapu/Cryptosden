import * as tf      from '@tensorflow/tfjs-node';
import PriceHistory from '../models/PriceHistory.js';
import Prediction   from '../models/Prediction.js';
import Crypto       from '../models/Crypto.js';
import { minMaxNormalize, denormalize, clamp } from '../utils/mathUtils.js';

const SEQ_LEN    = 60;
const FEATURES   = 13;
let   isTraining = false;

const FEATURE_KEYS = [
  'close', 'open', 'high', 'low', 'volume',
  'rsi14', 'macd', 'macdSignal',
  'bbUpper', 'bbLower', 'sma20',
  'volumeRatio', 'priceRange',
];

// ── Render free tier limits ───────────────────────────────────────────────
const RENDER_CONFIG = {
  EPOCHS:        20,
  BATCH_SIZE:    32,
  GRU_UNITS_1:   48,
  GRU_UNITS_2:   24,
  DENSE_UNITS:   16,
  MC_RUNS:       8,
  COIN_DELAY_MS: 3000,
  TOP_N:         100,
};

// ════════════════════════════════════════════════════════════════
// EXCHANGE RATES
// ════════════════════════════════════════════════════════════════
let   cachedRates   = null;
let   ratesCachedAt = 0;
const RATES_TTL_MS  = 60 * 60 * 1000;

const getExchangeRates = async () => {
  if (cachedRates && (Date.now() - ratesCachedAt) < RATES_TTL_MS) return cachedRates;
  try {
    const res  = await fetch('https://api.exchangerate-api.com/v4/latest/USD',
      { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    cachedRates   = {
      usd: 1,
      inr: data.rates?.INR || 83.5,
      eur: data.rates?.EUR || 0.92,
      gbp: data.rates?.GBP || 0.79,
    };
    ratesCachedAt = Date.now();
    console.log(`  Exchange rates: INR=${cachedRates.inr} EUR=${cachedRates.eur}`);
    return cachedRates;
  } catch {
    console.warn('  Exchange rate fetch failed — using fallback');
    return { usd: 1, inr: 83.5, eur: 0.92, gbp: 0.79 };
  }
};

const toAllCurrencies = (priceUSD, rates) => ({
  usd: +priceUSD.toFixed(8),
  inr: +(priceUSD * rates.inr).toFixed(4),
  eur: +(priceUSD * rates.eur).toFixed(8),
  gbp: +(priceUSD * rates.gbp).toFixed(8),
});

// ════════════════════════════════════════════════════════════════
// MODEL
// ════════════════════════════════════════════════════════════════
const buildModel = () => {
  const model = tf.sequential();

  model.add(tf.layers.gru({
    units:                RENDER_CONFIG.GRU_UNITS_1,
    inputShape:           [SEQ_LEN, FEATURES],
    returnSequences:      true,
    dropout:              0.2,
    recurrentDropout:     0.0,
    kernelInitializer:    'glorotUniform',
    recurrentInitializer: 'glorotUniform', // ✅ fixed — was 'orthogonal' (caused slowness warning)
  }));

  model.add(tf.layers.gru({
    units:                RENDER_CONFIG.GRU_UNITS_2,
    returnSequences:      false,
    dropout:              0.2,
    kernelInitializer:    'glorotUniform',
    recurrentInitializer: 'glorotUniform', // ✅ fixed — was 'orthogonal' (caused slowness warning)
  }));

  model.add(tf.layers.dense({ units: RENDER_CONFIG.DENSE_UNITS, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 1 }));

  model.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });
  return model;
};

// ════════════════════════════════════════════════════════════════
// FEATURE ENGINEERING
// ════════════════════════════════════════════════════════════════
const normalizeFeatures = (records) => {
  const scalers    = {};
  const normalized = FEATURE_KEYS.map(key => {
    const vals               = records.map(r => r[key] ?? 0);
    const { norm, min, range } = minMaxNormalize(vals);
    scalers[key]             = { min, range };
    return norm;
  });
  const matrix = records.map((_, t) =>
    FEATURE_KEYS.map((_, f) => normalized[f][t])
  );
  return { matrix, scalers };
};

const makeSequences = (matrix) => {
  const X = [], Y = [];
  for (let i = 0; i < matrix.length - SEQ_LEN; i++) {
    X.push(matrix.slice(i, i + SEQ_LEN));
    Y.push(matrix[i + SEQ_LEN][0]);
  }
  return { X, Y };
};

// ════════════════════════════════════════════════════════════════
// MONTE CARLO
// ════════════════════════════════════════════════════════════════
const monteCarloPredict = async (model, inputSeq) => {
  const predictions = [];

  for (let i = 0; i < RENDER_CONFIG.MC_RUNS; i++) {
    const noisy = inputSeq.map(step =>
      step.map(v => v + (Math.random() - 0.5) * 0.01)
    );
    const inp = tf.tensor3d([noisy]);
    const out = model.predict(inp);
    predictions.push((await out.data())[0]);
    inp.dispose();
    out.dispose();
  }

  const mean = predictions.reduce((s, v) => s + v, 0) / RENDER_CONFIG.MC_RUNS;
  const std  = Math.sqrt(
    predictions.reduce((s, v) => s + (v - mean) ** 2, 0) / RENDER_CONFIG.MC_RUNS
  );
  return { meanPred: mean, stdPred: std, low95: mean - 1.96 * std, high95: mean + 1.96 * std };
};

// ════════════════════════════════════════════════════════════════
// MULTI-STEP PREDICTION
// ════════════════════════════════════════════════════════════════
const predictNDays = async (model, matrix, days) => {
  let seq = [...matrix.slice(-SEQ_LEN)];

  for (let d = 0; d < days; d++) {
    const inp  = tf.tensor3d([seq.slice(-SEQ_LEN)]);
    const out  = model.predict(inp);
    const next = (await out.data())[0];
    inp.dispose();
    out.dispose();

    const newStep = [...seq[seq.length - 1]];
    newStep[0]    = next;
    seq.push(newStep);
  }

  return seq[seq.length - 1][0];
};

// ════════════════════════════════════════════════════════════════
// MAPE
// ════════════════════════════════════════════════════════════════
const computeMAPE = (actual, predicted) => {
  const pct = actual.map((a, i) =>
    a !== 0 ? Math.abs((a - predicted[i]) / a) * 100 : 0
  );
  return pct.reduce((s, v) => s + v, 0) / pct.length;
};

// ════════════════════════════════════════════════════════════════
// MEMORY GUARD
// ════════════════════════════════════════════════════════════════
const isMemorySafe = () => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  if (used > 400) {
    console.warn(`  Memory warning: ${used.toFixed(0)}MB used — pausing 30s for GC`);
    return false;
  }
  return true;
};

const cleanupTF = () => {
  tf.disposeVariables();
  if (global.gc) global.gc();
};

// ════════════════════════════════════════════════════════════════
// TRAIN ONE COIN
// ════════════════════════════════════════════════════════════════
export const trainGRU = async (coinId) => {
  console.log(`  Training GRU for ${coinId}...`);

  if (!isMemorySafe()) {
    await new Promise(r => setTimeout(r, 30000));
  }

  let model     = null;
  let xTensor   = null;
  let yTensor   = null;
  let valTensor = null;

  try {
    const [records, rates] = await Promise.all([
      PriceHistory.find({ coinId }).sort({ timestamp: 1 }).lean(),
      getExchangeRates(),
    ]);

    if (records.length < SEQ_LEN + 30) {
      console.log(`  Skip ${coinId}: only ${records.length} records (need ${SEQ_LEN + 30})`);
      return null;
    }

    const { matrix, scalers } = normalizeFeatures(records);
    const { X, Y }            = makeSequences(matrix);

    xTensor = tf.tensor3d(X);
    yTensor = tf.tensor2d(Y, [Y.length, 1]);
    model   = buildModel();

    let finalLoss = 0;

    await model.fit(xTensor, yTensor, {
      epochs:          RENDER_CONFIG.EPOCHS,
      batchSize:       RENDER_CONFIG.BATCH_SIZE,
      validationSplit: 0.1,
      shuffle:         false,
      verbose:         0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          finalLoss = logs.loss;
          if (epoch % 10 === 0) {
            const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
            console.log(
              `  ${coinId} e${epoch}: loss=${logs.loss.toFixed(6)} ` +
              `val=${logs.val_loss?.toFixed(6)} RAM=${mem}MB`
            );
          }
        },
      },
    });

    xTensor.dispose(); xTensor = null;
    yTensor.dispose(); yTensor = null;

    // ── Validation MAPE ───────────────────────────────────────────
    const valStart       = Math.floor(X.length * 0.9);
    valTensor            = tf.tensor3d(X.slice(valStart));
    const valPreds       = Array.from(await model.predict(valTensor).data());
    valTensor.dispose(); valTensor = null;

    const { min: closeMin, range: closeRange } = scalers.close;
    const actualPrices    = Y.slice(valStart).map(v => denormalize(v, closeMin, closeRange));
    const predictedPrices = valPreds.map(v => denormalize(v, closeMin, closeRange));
    const mape            = computeMAPE(actualPrices, predictedPrices);

    const lastMatrix = matrix.slice(-SEQ_LEN);
    const currentUSD = records[records.length - 1].close;

    // ── Predict 4 horizons ────────────────────────────────────────
    const HORIZONS    = { day1: 1, day7: 7, day14: 14, day30: 30 };
    const predictions = {};

    for (const [key, days] of Object.entries(HORIZONS)) {
      const normPred                         = await predictNDays(model, matrix, days);
      const { low95: confLow, high95: confHigh } = await monteCarloPredict(model, lastMatrix);

      const predictedUSD = denormalize(normPred,  closeMin, closeRange);
      const low95USD     = denormalize(confLow,   closeMin, closeRange);
      const high95USD    = denormalize(confHigh,  closeMin, closeRange);
      const pctChange    = ((predictedUSD - currentUSD) / currentUSD) * 100;

      predictions[key] = {
        price:        toAllCurrencies(predictedUSD, rates),
        low95:        toAllCurrencies(low95USD,     rates),
        high95:       toAllCurrencies(high95USD,    rates),
        currentPrice: toAllCurrencies(currentUSD,  rates),
        change:       +pctChange.toFixed(2),
        direction:    pctChange > 1 ? 'Bullish' : pctChange < -1 ? 'Bearish' : 'Neutral',
      };
    }

    model.dispose(); model = null;

    await Prediction.findOneAndUpdate(
      { coinId },
      {
        coinId,
        predictions,
        currentPrice: toAllCurrencies(currentUSD, rates),
        trainedAt:    new Date(),
        dataPoints:   records.length,
        modelLoss:    +finalLoss.toFixed(6),
        mape:         +mape.toFixed(2),
        ratesAt:      rates,
      },
      { upsert: true, new: true }
    );

    const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
    console.log(
      `  Done: ${coinId} | loss=${finalLoss.toFixed(4)} MAPE=${mape.toFixed(2)}% | ` +
      `$${currentUSD.toFixed(4)} → $${predictions.day1.price.usd} | RAM=${mem}MB`
    );

    return predictions;

  } catch (err) {
    console.error(`  GRU failed [${coinId}]:`, err.message);
    return null;

  } finally {
    try { xTensor?.dispose();   } catch {}
    try { yTensor?.dispose();   } catch {}
    try { valTensor?.dispose(); } catch {}
    try { model?.dispose();     } catch {}
    cleanupTF();
  }
};

// ════════════════════════════════════════════════════════════════
// TRAIN ALL COINS
// ════════════════════════════════════════════════════════════════
export const trainAllGRU = async (topN = RENDER_CONFIG.TOP_N) => {
  if (isTraining) {
    console.log('  GRU training in progress — skipping');
    return;
  }
  isTraining = true;

  const startTime = Date.now();
  const stats     = { success: 0, failed: 0, skipped: 0 };

  try {
    const coinIds = await PriceHistory.distinct('coinId');
    const coins   = await Crypto.find({
      coinId: { $in: coinIds },
      rank:   { $exists: true, $lte: topN },
    })
      .sort({ rank: 1 })
      .select('coinId rank')
      .lean();

    const estMins = Math.ceil(coins.length * 1.5);
    const estHrs  = (estMins / 60).toFixed(1);

    console.log(`\n GRU Training — ${coins.length} coins sequentially`);
    console.log(`  Epochs: ${RENDER_CONFIG.EPOCHS} | Batch: ${RENDER_CONFIG.BATCH_SIZE}`);
    console.log(`  GRU units: ${RENDER_CONFIG.GRU_UNITS_1}/${RENDER_CONFIG.GRU_UNITS_2}`);
    console.log(`  Est. time: ~${estMins} min (~${estHrs} hrs)\n`);

    for (let i = 0; i < coins.length; i++) {
      const { coinId, rank } = coins[i];
      console.log(`\n [${i + 1}/${coins.length}] #${rank} ${coinId}`);

      const result = await trainGRU(coinId);

      if (result) stats.success++;
      else        stats.failed++;

      const delay = (i + 1) % 10 === 0
        ? RENDER_CONFIG.COIN_DELAY_MS * 3   // 9s every 10 coins
        : RENDER_CONFIG.COIN_DELAY_MS;       // 3s between coins

      if (i < coins.length - 1) {
        console.log(`  Waiting ${delay / 1000}s before next coin...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const mem     = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);

    console.log(`\n GRU Training Complete`);
    console.log(`  Coins     : ${coins.length}`);
    console.log(`  Success   : ${stats.success}`);
    console.log(`  Failed    : ${stats.failed}`);
    console.log(`  Time      : ${elapsed} minutes`);
    console.log(`  Final RAM : ${mem}MB`);

  } finally {
    isTraining = false;
  }
};