import Crypto    from '../models/Crypto.js';
import Sentiment from '../models/Sentiment.js';
import { clamp } from '../utils/mathUtils.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Shared CryptoPanic rate-limit state ───────────────────────────────────
const cpState = {
  banned:    false,
  banUntil:  0,
  callCount: 0,
};

// ── Fear & Greed cache ─────────────────────────────────────────────────────
let cachedFearGreed   = 50;
let cachedFearGreedAt = 0;
const FG_TTL_MS       = 60 * 60 * 1000; // 1 hour

const fetchFearGreed = async () => {
  if (cachedFearGreedAt && (Date.now() - cachedFearGreedAt) < FG_TTL_MS) {
    return cachedFearGreed;
  }
  try {
    const res  = await fetch('https://api.alternative.me/fng/?limit=1',
      { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    cachedFearGreed   = parseInt(data.data?.[0]?.value || 50);
    cachedFearGreedAt = Date.now();
    console.log(`   Fear & Greed fetched: ${cachedFearGreed}`);
    return cachedFearGreed;
  } catch {
    return cachedFearGreed;
  }
};

// ══════════════════════════════════════════════════════════════════════════
// SOURCE 1 + 3 — Single CryptoPanic call (votes 40% + tone 20%)
// ══════════════════════════════════════════════════════════════════════════
const getCryptoPanicData = async (symbol) => {
  if (cpState.banned && Date.now() < cpState.banUntil) {
    console.log(`    CryptoPanic rate-limited — skipping ${symbol}`);
    return { voteScore: 50, toneScore: 50, newsCount: 0 };
  }

  try {
    const sym = symbol?.toUpperCase();
    const url = `https://cryptopanic.com/api/free/v1/posts/?auth_token=${
      process.env.CRYPTOPANIC_API_KEY || ''
    }&currencies=${sym}&filter=hot&public=true`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    cpState.callCount++;

    if (res.status === 429 || res.status === 403) {
      cpState.banned   = true;
      cpState.banUntil = Date.now() + 15 * 60 * 1000;
      console.log(`   CryptoPanic rate limit hit (call #${cpState.callCount}) — cooling 15 min`);
      return { voteScore: 50, toneScore: 50, newsCount: 0 };
    }

    if (!res.ok) return { voteScore: 50, toneScore: 50, newsCount: 0 };
    cpState.banned = false;

    const data    = await res.json();
    const results = data.results || [];
    if (!results.length) return { voteScore: 50, toneScore: 50, newsCount: 0 };

    // ── Community vote sentiment (40%) ────────────────────────────────────
    let totalBullish = 0, totalBearish = 0, totalNeutral = 0, importantCount = 0;

    results.slice(0, 20).forEach(post => {
      const votes   = post.votes || {};
      const bullish = (votes.positive || 0) + (votes.liked    || 0);
      const bearish = (votes.negative || 0) + (votes.disliked || 0) + (votes.toxic || 0);
      const neutral = (votes.important|| 0) + (votes.saved    || 0) + (votes.lol   || 0);
      totalBullish += bullish;
      totalBearish += bearish;
      totalNeutral += neutral;
      if (votes.important > 0) importantCount++;
    });

    // FIX: Removed +1 bias from denominator — was skewing score low
    const rawVote =
      (totalBullish + totalBearish) === 0
        ? 50
        : (totalBullish / (totalBullish + totalBearish)) * 100;

    const attentionBoost = importantCount > 3 ? 5 : 0;
    const voteScore      = clamp(parseFloat((rawVote + attentionBoost).toFixed(1)), 0, 100);

    // ── Headline tone (20%) — same posts, zero extra calls ─────────────
    const POSITIVE_WORDS = ['surge','rally','breakthrough','record','high','launch','upgrade',
      'partnership','adoption','bullish','growth','rise','gains','soar',
      'integrate','milestone','approve','support','invest','expand'];
    const NEGATIVE_WORDS = ['crash','plunge','hack','exploit','ban','lawsuit','regulatory',
      'bearish','drop','fall','sink','fraud','investigation','suspend',
      'warning','risk','fear','dump','scam','attacked'];

    let pos = 0, neg = 0;
    const now = Date.now();

    results.slice(0, 15).forEach(post => {
      const title    = (post.title || '').toLowerCase();
      const ageHours = (now - new Date(post.published_at).getTime()) / 3600000;
      const weight   = ageHours < 6 ? 2 : 1;
      let posHit = false, negHit = false;
      POSITIVE_WORDS.forEach(w => { if (title.includes(w)) posHit = true; });
      NEGATIVE_WORDS.forEach(w => { if (title.includes(w)) negHit = true; });
      if (posHit) pos += weight;
      if (negHit) neg += weight;
    });

    // FIX: Default changed from 55 → 50 (neutral), was biasing scores upward
    const toneScore = (pos + neg) === 0
      ? 50
      : clamp(parseFloat(((pos / (pos + neg)) * 100).toFixed(1)), 0, 100);

    return {
      voteScore, toneScore,
      newsCount:    results.length,
      totalBullish,
      totalBearish,
    };
  } catch {
    return { voteScore: 50, toneScore: 50, newsCount: 0 };
  }
};

// ══════════════════════════════════════════════════════════════════════════
// SOURCE 2 — CoinPaprika Twitter/X Sentiment (25%)
// ══════════════════════════════════════════════════════════════════════════
const getTwitterSentiment = async (coinId) => {
  try {
    const res = await fetch(
      `https://api.coinpaprika.com/v1/coins/${coinId}/twitter`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return 50;
    const tweets = await res.json();
    if (!Array.isArray(tweets) || tweets.length < 3) return 50;

    const BULLISH = ['bullish','moon','buy','accumulate','breakout','pump','surge','ath',
      'green','rally','hodl','long','🚀','💎','🔥','📈'];
    const BEARISH = ['bearish','dump','sell','crash','rekt','short','scam','hack',
      'ban','lawsuit','fear','drop','📉','💀','🔴','bearmarket'];

    let totalScore = 0;
    let tweetCount = 0;

    tweets.slice(0, 50).forEach(t => {
      const text      = (t.status || '').toLowerCase();
      const influence = (t.like_count || 0) + (t.retweet_count || 0);
      let   tweetScore = 0;
      BULLISH.forEach(w => { if (text.includes(w)) tweetScore += 6; });
      BEARISH.forEach(w => { if (text.includes(w)) tweetScore -= 6; });
      if (tweetScore === 0) return;

      // FIX: Cap individual tweet contribution to ±20 before weighting
      tweetScore = Math.max(-20, Math.min(20, tweetScore));

      const weight = influence > 500 ? 4 : influence > 100 ? 2 : 1;
      totalScore += tweetScore * weight;
      tweetCount++;
    });

    if (tweetCount === 0) return 50;

    // FIX: Normalize by tweet count to prevent runaway accumulation
    const normalized = 50 + (totalScore / tweetCount);
    return clamp(parseFloat(normalized.toFixed(1)), 0, 100);

  } catch {
    return 50;
  }
};

// ══════════════════════════════════════════════════════════════════════════
// COMPUTE eVI — 4 sources
// CryptoPanic votes 40% | Twitter 25% | Headline tone 20% | Fear&Greed 15%
// ══════════════════════════════════════════════════════════════════════════
const computeEVI = async (coin, globalFearGreed) => {
  const { coinId, symbol } = coin;

  const [cpData, twitter] = await Promise.all([
    getCryptoPanicData(symbol),    // ✅ parallel fetch
    getTwitterSentiment(coinId),   // ✅ parallel fetch
  ]);

  const composite =
    cpData.voteScore * 0.40 +
    twitter          * 0.25 +
    cpData.toneScore * 0.20 +
    globalFearGreed  * 0.15;

  const eVI   = clamp(parseFloat(composite.toFixed(1)), 0, 100);
  const label =
    eVI <  20 ? 'Extreme Fear' :
    eVI <  40 ? 'Fear'         :
    eVI <  55 ? 'Neutral'      :
    eVI <  75 ? 'Greed'        : 'Extreme Greed';

  const fearGreedLabel =
    globalFearGreed <  25 ? 'Extreme Fear' :
    globalFearGreed <  45 ? 'Fear'         :
    globalFearGreed <  55 ? 'Neutral'      :
    globalFearGreed <  75 ? 'Greed'        : 'Extreme Greed';

  return {
    eVI, label,
    fearGreedValue: globalFearGreed,
    fearGreedLabel,
    breakdown: {
      communityVotes: parseFloat(cpData.voteScore.toFixed(1)),
      twitterMood:    parseFloat(twitter.toFixed(1)),
      newsTone:       parseFloat(cpData.toneScore.toFixed(1)),
      fearGreed:      globalFearGreed,
    },
    meta: {
      newsCount:    cpData.newsCount    || 0,
      bullishVotes: cpData.totalBullish || 0,
      bearishVotes: cpData.totalBearish || 0,
    },
  };
};

// ══════════════════════════════════════════════════════════════════════════
// PROCESS ONE COIN — save to DB
// ══════════════════════════════════════════════════════════════════════════
const processCoin = async (coin, globalFearGreed) => {
  const result = await computeEVI(coin, globalFearGreed);

  await Sentiment.findOneAndUpdate(
    { coinId: coin.coinId },
    { coinId: coin.coinId, ...result, computedAt: new Date() },
    { upsert: true, new: true }
  );

  // FIX: Added upsert:true — was silently failing if coin not in Crypto collection
  await Crypto.findOneAndUpdate(
    { coinId: coin.coinId },
    { $set: { eVI: result.eVI } },
    { upsert: true }
  );

  return result;
};

// ══════════════════════════════════════════════════════════════════════════
// BATCH PROCESSOR
// ══════════════════════════════════════════════════════════════════════════
const processBatch = async (coins, batchIndex, totalBatches, stats, globalFearGreed) => {
  console.log(`\n Batch ${batchIndex + 1}/${totalBatches} — ${coins.length} coins`);

  for (const coin of coins) {
    if (cpState.banned && Date.now() < cpState.banUntil) {
      const waitMs = cpState.banUntil - Date.now();
      console.log(`\n   CryptoPanic cooldown — pausing ${(waitMs / 60000).toFixed(1)} min...`);
      await sleep(waitMs);
      cpState.banned = false;
      console.log('   Cooldown complete — resuming\n');
    }

    try {
      const result = await processCoin(coin, globalFearGreed);
      stats.computed++;
      console.log(
        `   [#${coin.rank || '?'}] ${coin.symbol?.padEnd(8)} ` +
        `eVI: ${String(result.eVI).padStart(5)} — ${result.label} ` +
        `| FG: ${globalFearGreed} (CP: ${cpState.callCount})`
      );
    } catch (err) {
      stats.failed++;
      stats.errors.push({ coin: coin.coinId, error: err.message });
      console.error(`   [${coin.coinId}]: ${err.message}`);
    }

    await sleep(1500);
  }
};

// ══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — all coins sorted by rank
// ══════════════════════════════════════════════════════════════════════════
export const runSentimentService = async () => {
  const startTime = Date.now();

  // FIX: Reset callCount each run — was growing infinitely across cron runs
  cpState.callCount = 0;

  const globalFearGreed = await fetchFearGreed();
  console.log(`   Global Fear & Greed : ${globalFearGreed}\n`);

  const allCoins = await Crypto.find({ rank: { $gte: 1, $lte: 500 } })
    .sort({ rank: 1 })
    .lean();

  if (!allCoins.length) {
    console.log('  No coins found in MongoDB. Exiting.');
    return;
  }

  console.log(`  Total coins found : ${allCoins.length}`);

  const BATCH_SIZE = 10;
  const batches    = [];
  for (let i = 0; i < allCoins.length; i += BATCH_SIZE) {
    batches.push(allCoins.slice(i, i + BATCH_SIZE));
  }

  console.log(`  Batch size    : ${BATCH_SIZE} coins`);
  console.log(`  Total batches : ${batches.length}`);
  console.log(`  Est. time     : ~${Math.ceil((allCoins.length * 1.5) / 60)} minutes\n`);

  const stats = { computed: 0, failed: 0, errors: [] };

  for (let i = 0; i < batches.length; i++) {
    await processBatch(batches[i], i, batches.length, stats, globalFearGreed);
    if (i < batches.length - 1) {
      console.log(`\n    Cooling down...`);
      await sleep(5000);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(` Sentiment Service Complete`);
  console.log(`   Total coins  : ${allCoins.length}`);
  console.log(`   Computed     : ${stats.computed}`);
  console.log(`   Failed       : ${stats.failed}`);
  console.log(`   Fear&Greed   : ${globalFearGreed}`);
  console.log(`   CP API calls : ${cpState.callCount}`);
  console.log(`   Time taken   : ${elapsed}s`);

  if (stats.errors.length > 0) {
    stats.errors.forEach(e => console.log(`   - ${e.coin}: ${e.error}`));
  }

  return stats;
};

// ══════════════════════════════════════════════════════════════════════════
// SINGLE COIN — on-demand refresh
// ══════════════════════════════════════════════════════════════════════════
export const runSentimentForCoin = async (coinId) => {
  const coin = await Crypto.findOne({ coinId }).lean();
  if (!coin) throw new Error(`Coin not found: ${coinId}`);

  const globalFearGreed = await fetchFearGreed();
  console.log(` Running sentiment for ${coin.symbol} (FG: ${globalFearGreed})...`);
  const result = await processCoin(coin, globalFearGreed);
  console.log(` [${coin.symbol}] eVI: ${result.eVI} — ${result.label}`);
  return result;
};