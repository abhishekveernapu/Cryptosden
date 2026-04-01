import Crypto       from '../models/Crypto.js';
import PriceHistory from '../models/PriceHistory.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Technical Indicators ───────────────────────────────────────────────────

const computeRSI = (closes, period = 14) => {
  if (closes.length < period + 1) return new Array(closes.length).fill(50);
  const rsi = new Array(period).fill(null);

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains  += diff;
    else          losses -= diff;
  }

  let avgGain = gains  / period;
  let avgLoss = losses / period;

  for (let i = period; i < closes.length; i++) {
    if (i > period) {
      const diff = closes[i] - closes[i - 1];
      avgGain  = (avgGain  * (period - 1) + Math.max(diff,  0)) / period;
      avgLoss  = (avgLoss  * (period - 1) + Math.max(-diff, 0)) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }
  return rsi;
};

const computeEMA = (data, period) => {
  const k   = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
};

const computeMACD = (closes) => {
  const ema12  = computeEMA(closes, 12);
  const ema26  = computeEMA(closes, 26);
  const macd   = ema12.map((v, i) => v - ema26[i]);
  const signal = computeEMA(macd.slice(26), 9);
  const result = new Array(26).fill({ macd: 0, signal: 0 });
  for (let i = 26; i < closes.length; i++) {
    result.push({ macd: macd[i], signal: signal[i - 26] || 0 });
  }
  return result;
};

const computeBollingerBands = (closes, period = 20) => {
  const result = new Array(period - 1).fill({ upper: 0, lower: 0 });
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const avg   = slice.reduce((s, v) => s + v, 0) / period;
    const std   = Math.sqrt(slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period);
    result.push({ upper: avg + 2 * std, lower: avg - 2 * std });
  }
  return result;
};

const computeSMA = (closes, period = 20) => {
  const result = new Array(period - 1).fill(0);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    result.push(slice.reduce((s, v) => s + v, 0) / period);
  }
  return result;
};

const computeVolumeRatio = (volumes, period = 20) => {
  const result = new Array(period - 1).fill(1);
  for (let i = period - 1; i < volumes.length; i++) {
    const avg = volumes.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period;
    result.push(avg > 0 ? volumes[i] / avg : 1);
  }
  return result;
};

// ── Fetch market chart from CoinGecko (prices + real volumes) ──────────────
// FIX: Replaced /ohlc (no volume) with /market_chart (real volume data)
const fetchMarketChart = async (coinId, days = 365, retries = 3) => {
  const url = new URL(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`
  );
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('days',        String(days));
  url.searchParams.set('interval',    'daily');
  if (process.env.COINGECKO_API_KEY) {
    url.searchParams.set('x_cg_demo_api_key', process.env.COINGECKO_API_KEY5);
  }

  try {
    // FIX: Added AbortSignal.timeout — prevents infinite hangs
    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
      signal:  AbortSignal.timeout(10000),
    });

    if (res.status === 429) {
      // FIX: Bounded retries instead of infinite recursion
      if (retries <= 0) {
        console.warn(`⚠️  Rate limited on ${coinId} — giving up after 3 retries`);
        return null;
      }
      console.warn(`⚠️  Rate limited on ${coinId} — waiting 60s (${retries} retries left)`);
      await sleep(60000);
      return fetchMarketChart(coinId, days, retries - 1);
    }

    if (res.status === 404) return null;
    if (!res.ok)            return null;

    return res.json();
    // Returns: {
    //   prices:        [[ts, close], ...],
    //   market_caps:   [[ts, mcap], ...],
    //   total_volumes: [[ts, volume], ...],   ← real volume ✅
    // }
  } catch (err) {
    // AbortSignal timeout fires here as well
    console.warn(`⚠️  fetchMarketChart timeout/error [${coinId}]: ${err.message}`);
    return null;
  }
};

// ── Save price history with computed indicators ────────────────────────────
export const fetchCoinHistory = async (coinId, days = 365) => {
  try {
    const data = await fetchMarketChart(coinId, days);
    if (!data?.prices?.length) return 0;

    const prices  = data.prices;           // [[ts, close], ...]
    const volumes = data.total_volumes;    // [[ts, volume], ...]  ← real volume ✅

    const closes     = prices.map(([, c])  => c);
    const volValues  = volumes.map(([, v]) => v || 0);   // FIX: real volumes now

    const rsi         = computeRSI(closes);
    const macdArr     = computeMACD(closes);
    const bbArr       = computeBollingerBands(closes);
    const smaArr      = computeSMA(closes);
    const volRatioArr = computeVolumeRatio(volValues);   // FIX: meaningful ratio now

    const ops = prices.map(([ts, close], i) => ({
      updateOne: {
        filter: { coinId, timestamp: new Date(ts) },
        update: {
          $set: {
            coinId,
            timestamp:   new Date(ts),
            // market_chart gives close only — open/high/low approximated
            open:        close,
            high:        close,
            low:         close,
            close,
            volume:      volValues[i]        || 0,       // ✅ real volume
            rsi14:       rsi[i]              || 50,
            macd:        macdArr[i]?.macd    || 0,
            macdSignal:  macdArr[i]?.signal  || 0,
            bbUpper:     bbArr[i]?.upper     || close * 1.02,
            bbLower:     bbArr[i]?.lower     || close * 0.98,
            sma20:       smaArr[i]           || close,
            volumeRatio: volRatioArr[i]      || 1,       // ✅ meaningful now
            priceRange:  0,  // no high/low from market_chart
          },
        },
        upsert: true,
      },
    }));

    await PriceHistory.bulkWrite(ops, { ordered: false });
    return prices.length;

  } catch (err) {
    console.error(`Error PriceHistory [${coinId}]:`, err.message);
    return 0;
  }
};

// ── Fetch for top N coins by rank ──────────────────────────────────────────
export const fetchAllPriceHistory = async (topN = 100) => {
  const coins = await Crypto.find({ rank: { $exists: true, $ne: null } })
    .sort({ rank: 1 })
    .limit(topN)         // FIX: uses topN param correctly
    .select('coinId rank')
    .lean();

  if (!coins.length) {
    console.log('  No coins in DB — skipping history fetch');
    return;
  }

  console.log(` Fetching history for top ${coins.length} coins...`);

  for (const coin of coins) {
    const count = await fetchCoinHistory(coin.coinId);
    console.log(`  #${coin.rank} ${coin.coinId}: ${count} candles`);
    await sleep(3000);
  }

  console.log(' Price history complete');
};