import Crypto      from '../models/Crypto.js';
import Prediction  from '../models/Prediction.js';
import Alert       from '../models/Alert.js';
import TrustScore  from '../models/TrustScore.js';
import { clamp }   from '../utils/mathUtils.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Trending cache (shared across all coins in a run) ─────────
const cgState = {
  trendingCache: null,
  trendingAt:    0,
};

// SOURCE 1 — Fear & Greed (25%)
// Fetched ONCE and shared across all coins
const getFearGreedScore = async () => {
  try {
    const res  = await fetch('https://api.alternative.me/fng/?limit=1',
      { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    return parseInt(data.data?.[0]?.value || 50);
  } catch {
    return 50;
  }
};

// SOURCE 2 — Market Health (20%) — pure computation, no API call
const getMarketHealthScore = (coin) => {
  const change7d      = coin.change7d || 0;
  const momentumScore = clamp(50 + change7d * 2, 0, 100);

  const volMcap  = coin.marketCap?.usd > 0
    ? (coin.volume24h?.usd || 0) / coin.marketCap.usd
    : 0;
  const volScore = clamp(volMcap * 100 * 20, 0, 100);

  // Scale rank bonus across all coins — not just top 50
  const rank      = coin.rank || 9999;
  const rankBonus =
    rank <= 10   ? 95 :
    rank <= 50   ? 80 :
    rank <= 100  ? 65 :
    rank <= 500  ? 50 :
    rank <= 1000 ? 38 : 25;

  return momentumScore * 0.5 + volScore * 0.35 + rankBonus * 0.15;
};

// SOURCE 3 — CoinGecko Trending (10%)
// Cached for 10 min — ONE call shared across ALL coins
const fetchTrendingList = async () => {
  const now = Date.now();

  if (cgState.trendingCache && (now - cgState.trendingAt) < 10 * 60 * 1000) {
    return cgState.trendingCache;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/search/trending${
      process.env.COINGECKO_API_KEY
        ? `?x_cg_demo_api_key=${process.env.COINGECKO_API_KEY5}`
        : ''
    }`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (res.status === 429) {
      console.log(' "Alert"  CoinGecko trending rate-limited — using cached/empty list');
      return cgState.trendingCache || [];
    }

    const data = await res.json();
    cgState.trendingCache = data.coins || [];
    cgState.trendingAt    = now;
    console.log(`   Trending list cached: ${cgState.trendingCache.length} coins`);
    return cgState.trendingCache;
  } catch {
    return cgState.trendingCache || [];
  }
};

const getTrendingScore = (coinId, trendingList) => {
  const rank = trendingList.findIndex(t => t.item?.id === coinId);
  if (rank === -1) return 35;
  if (rank <= 2)   return 90;
  if (rank <= 6)   return 75;
  return 65;
};

 
// SOURCE 4 — CoinPaprika Social Twitter (20%)
const getCoinPaprikaSocialScore = async (coinId) => {
  try {
    const res = await fetch(
      `https://api.coinpaprika.com/v1/coins/${coinId}/twitter`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return 50;
    const tweets = await res.json();
    if (!tweets?.length) return 50;

    const POSITIVE = ['bullish','buy','moon','pump','up','gain','rally','surge','growth'];
    const NEGATIVE = ['bearish','sell','crash','dump','down','loss','fall','drop','fear'];

    let pos = 0, neg = 0;
    tweets.slice(0, 50).forEach(t => {
      const text = (t.status || '').toLowerCase();
      if (POSITIVE.some(w => text.includes(w))) pos++;
      if (NEGATIVE.some(w => text.includes(w))) neg++;
    });

    const total = pos + neg || 1;
    return clamp((pos / total) * 100, 0, 100);
  } catch {
    return 50;
  }
};

// SOURCE 5 — Blockchain.info On-Chain BTC (15%)
// Returns 50 for all non-BTC coins — no wasted API call
const getOnChainScore = async (coinId) => {
  if (coinId !== 'bitcoin') return 50;
  try {
    const res  = await fetch(
      'https://blockchain.info/unconfirmed-transactions?format=json&limit=50',
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    const txs  = data.txs || [];

    const demandScore = clamp(txs.length * 2, 0, 100);
    const whaleTxs    = txs.filter(tx => {
      const totalOut = tx.out?.reduce((s, o) => s + (o.value || 0), 0) || 0;
      return totalOut >= 10_000_000_000;
    }).length;

    return clamp(demandScore - Math.min(whaleTxs * 5, 30), 0, 100);
  } catch {
    return 50;
  }
};

// ML ADJUSTMENT — GRU prediction + Anomaly alerts
const getMLAdjustment = async (coinId) => {
  let adjustment = 0;

  const prediction = await Prediction.findOne({ coinId }).lean();
  if (prediction?.predictions?.day1?.direction === 'Bullish') adjustment += 5;
  if (prediction?.predictions?.day1?.direction === 'Bearish') adjustment -= 5;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const whaleAlert = await Alert.findOne({
    coinId, type: 'whale_transfer',
    resolved: false, createdAt: { $gte: oneHourAgo },
  }).lean();
  if (whaleAlert) adjustment -= 8;

  const criticalAnomaly = await Alert.findOne({
    coinId,
    type:     { $in: ['zscore', 'isolation_forest'] },
    severity: 'critical',
    resolved: false,
    createdAt: { $gte: oneHourAgo },
  }).lean();
  if (criticalAnomaly) adjustment -= 10;

  return adjustment;
};

// COMPUTE TRUST SCORE FOR ONE COIN
const computeTrustScore = async (coin, fearGreedValue, trendingList) => {
  const [social, onChain, mlAdj] = await Promise.all([
    getCoinPaprikaSocialScore(coin.coinId),
    getOnChainScore(coin.coinId),
    getMLAdjustment(coin.coinId),
  ]);

  const marketHealth = getMarketHealthScore(coin);
  const trending     = getTrendingScore(coin.coinId, trendingList);

  const breakdown = {
    fearGreed:    fearGreedValue,
    marketHealth: parseFloat(marketHealth.toFixed(1)),
    trending:     parseFloat(trending.toFixed(1)),
    coinPaprika:  parseFloat(social.toFixed(1)),
    onChain:      parseFloat(onChain.toFixed(1)),
  };

  const composite =
    fearGreedValue * 0.25 +
    marketHealth   * 0.20 +
    social         * 0.20 +
    onChain        * 0.15 +
    trending       * 0.10 +
    50             * 0.10;   // reserved placeholder

  const finalScore = clamp(composite + mlAdj, 0, 100);

  const label =
    finalScore <= 20 ? 'Very Low Trust'  :
    finalScore <= 40 ? 'Low Trust'       :
    finalScore <= 60 ? 'Neutral'         :
    finalScore <= 80 ? 'High Trust'      : 'Very High Trust';

  return {
    score:        parseFloat(finalScore.toFixed(1)),
    label,
    breakdown,
    mlAdjustment: mlAdj,
  };
};

// MAIN EXPORT — ALL coins sorted by market cap descending
export const runTrustScoreService = async () => {
  const startTime = Date.now();
  

  //  Fetch ONCE — shared across all coins
  const [fearGreedValue, trendingList] = await Promise.all([
    getFearGreedScore(),
    fetchTrendingList(),
  ]);
  console.log(`Running TrustScore`);
  console.log(`  Fear & Greed : ${fearGreedValue}`);
  console.log(`  Trending     : ${trendingList.length} coins cached\n`);

  //  All coins with market cap, sorted by market cap descending
  const coins = await Crypto.find({
    rank: { $gte: 1, $lte: 1000 },
  })
    .sort({ rank: 1 })     
    .lean();

  console.log(`  Total coins found : ${coins.length}`);
  console.log(`  Est. time         : ~${Math.ceil((coins.length * 0.3) / 60)} minutes\n`);

  let computed = 0, failed = 0;

  for (const coin of coins) {
    try {
      const result = await computeTrustScore(coin, fearGreedValue, trendingList);

      await TrustScore.findOneAndUpdate(
        { coinId: coin.coinId },
        { coinId: coin.coinId, ...result, computedAt: new Date() },
        { upsert: true }
      );

      await Crypto.findOneAndUpdate(
        { coinId: coin.coinId },
        { $set: { trustScore: result.score } }
      );

      computed++;
      console.log(
        ` [mcap: $${((coin.marketCap?.usd || 0) / 1e9).toFixed(2)}B] ` +
        `${coin.symbol?.padEnd(8)} score: ${String(result.score).padStart(5)} — ${result.label}`
      );
    } catch (err) {
      failed++;
      console.error(`  [${coin.coinId}]: ${err.message}`);
    }

    await sleep(300);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(' TrustScore Service Complete              ');
  console.log(`   Total coins  : ${String(coins.length).padEnd(27)}`);
  console.log(`   Sorted by    : ${'Market Cap (desc)'.padEnd(27)}`);
  console.log(`   Computed  : ${String(computed).padEnd(27)}`);
  console.log(`   Failed    : ${String(failed).padEnd(27)}`);
  console.log(`   Time      : ${String(elapsed + 's').padEnd(27)}`);
};

// SINGLE COIN — on-demand refresh (used by coin route)
export const runTrustScoreForCoin = async (coinId) => {
  const coin = await Crypto.findOne({ coinId }).lean();
  if (!coin) throw new Error(`Coin not found: ${coinId}`);

  const [fearGreedValue, trendingList] = await Promise.all([
    getFearGreedScore(),
    fetchTrendingList(),   // returns cache if still fresh
  ]);

  
  const result = await computeTrustScore(coin, fearGreedValue, trendingList);

  await TrustScore.findOneAndUpdate(
    { coinId },
    { coinId, ...result, computedAt: new Date() },
    { upsert: true }
  );

  await Crypto.findOneAndUpdate(
    { coinId },
    { $set: { trustScore: result.score } }
  );

  return result;
};
