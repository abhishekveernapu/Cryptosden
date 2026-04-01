import Crypto       from '../models/Crypto.js';
import Sentiment    from '../models/Sentiment.js';
import TrustScore   from '../models/TrustScore.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getCoins = asyncHandler(async (req, res) => {
  const { page=1, limit=50, search='', sortBy='rank', sortDir='asc', currency='usd' } = req.query;
  const pageNum  = Math.max(1, +page);
  const limitNum = Math.min(250, Math.max(1, +limit));
  const filter   = search.trim() ? { $or: [
    { coinName: { $regex: search, $options: 'i' } },
    { symbol:   { $regex: search, $options: 'i' } },
    { coinId:   { $regex: search, $options: 'i' } },
  ]} : {};
  const sort = sortBy.startsWith('price') || sortBy.startsWith('marketCap') || sortBy.startsWith('volume')
    ? { [`${sortBy}.${currency}`]: sortDir === 'asc' ? 1 : -1 }
    : { [sortBy]: sortDir === 'asc' ? 1 : -1 };

  const [coins, total] = await Promise.all([
    Crypto.find(filter).sort(sort).skip((pageNum-1)*limitNum).limit(limitNum).lean(),
    Crypto.countDocuments(filter),
  ]);
  res.json({ success:true, total, page:pageNum, pages: Math.ceil(total/limitNum), coins });
});

const CURRENCIES = ['usd', 'inr', 'gbp', 'eur'];

export const getGlobalStats = asyncHandler(async (req, res) => {

  const coins = await Crypto.find({})
    .select('coinId marketCap volume24h change24h price')
    .lean();

  const btc = coins.find(c => c.coinId === 'bitcoin');
  const eth = coins.find(c => c.coinId === 'ethereum');

  // ✅ FIX 1: avgChange is currency-agnostic — compute ONCE outside loop
  const validCoins   = coins.filter(c => c.change24h != null);
  // ✅ FIX 2: divide by validCoins.length NOT coins.length (original bug)
  const avgChange24h = validCoins.length > 0
    ? validCoins.reduce((s, c) => s + c.change24h, 0) / validCoins.length
    : 0;

  const stats = {};

  for (const cur of CURRENCIES) {
    const totalMcap = coins.reduce((s, c) => s + (c.marketCap?.[cur] || 0), 0);
    const totalVol  = coins.reduce((s, c) => s + (c.volume24h?.[cur] || 0), 0);

    stats[cur] = {
      totalMarketCap:     totalMcap,
      totalVolume24h:     totalVol,
      btcDominance:       totalMcap > 0 ? parseFloat(((btc?.marketCap?.[cur] || 0) / totalMcap * 100).toFixed(2)) : 0,
      ethDominance:       totalMcap > 0 ? parseFloat(((eth?.marketCap?.[cur] || 0) / totalMcap * 100).toFixed(2)) : 0,
      btcPrice:           btc?.price?.[cur] || 0,
      ethPrice:           eth?.price?.[cur] || 0,
    };
  }

  // ✅ FIX 3: Keep flat USD fields at top level so existing frontend doesn't break
  res.json({
    success:            true,
    activeCoins:        coins.length,
    marketCapChange24h: parseFloat(avgChange24h.toFixed(2)),

    // ── backward-compatible flat USD fields ──
    totalMarketCap:     stats.usd.totalMarketCap,
    totalVolume24h:     stats.usd.totalVolume24h,
    btcDominance:       stats.usd.btcDominance,
    ethDominance:       stats.usd.ethDominance,
    btcPrice:           stats.usd.btcPrice,
    ethPrice:           stats.usd.ethPrice,

    // ── new multi-currency stats ──
    stats,
  });
});


export const getTrending = asyncHandler(async (req, res) => {

  // ✅ Fetch top 500 coins — enough to find real trending ones
  const coins = await Crypto.find({
    rank:           { $gte: 1, $lte: 500 },
    'volume24h.usd': { $gt: 100_000 },      // min $100K volume
  })
    .select('coinId coinName symbol image rank price change24h change7d marketCap volume24h trustScore eVI')
    .lean();

  // ════════════════════════════════════════════════════════════
  // TRENDING SCORE ALGORITHM — 4 signals
  // ════════════════════════════════════════════════════════════
  const scored = coins.map(coin => {
    const mcap = coin.marketCap?.usd || 1;
    const vol  = coin.volume24h?.usd || 0;

    // ── Signal 1: Volume/MarketCap ratio (40%) ──────────────
    // High vol/mcap = unusual trading activity = trending
    const volMcapRatio  = vol / mcap;
    const volScore      = Math.min(volMcapRatio * 100 * 10, 100);

    // ── Signal 2: Price momentum — 24h change (30%) ─────────
    // Strong positive move = trending up
    const change24h     = coin.change24h || 0;
    const momentumScore = Math.min(Math.max(50 + change24h * 2, 0), 100);

    // ── Signal 3: 7d trend consistency (20%) ─────────────────
    // Both 7d and 24h positive = sustained trend
    const change7d      = coin.change7d || 0;
    const trendScore    =
      change24h > 0 && change7d > 0 ? 80 :   // both green
      change24h > 0 && change7d < 0 ? 55 :   // reversal upward
      change24h < 0 && change7d > 0 ? 45 :   // pullback
      30;                                      // both red

    // ── Signal 4: Sentiment boost (10%) ──────────────────────
    // High eVI = people are talking about it
    const eVI           = coin.eVI || 50;
    const sentimentScore = eVI;

    // ── Final weighted score ──────────────────────────────────
    const trendingScore =
      volScore      * 0.40 +
      momentumScore * 0.30 +
      trendScore    * 0.20 +
      sentimentScore * 0.10;

    return {
      ...coin,
      trendingScore: parseFloat(trendingScore.toFixed(2)),
      trendingMeta: {
        volMcapRatio: parseFloat((volMcapRatio * 100).toFixed(2)), // as %
        volScore:     parseFloat(volScore.toFixed(1)),
        momentum:     parseFloat(momentumScore.toFixed(1)),
        trend:        parseFloat(trendScore.toFixed(1)),
        sentiment:    parseFloat(sentimentScore.toFixed(1)),
      },
    };
  });

  // ✅ Sort by trending score descending — top 10
  const trending = scored
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 10);

  res.json({ success: true, source: 'algorithm', coins: trending });
});


export const getGainersLosers = asyncHandler(async (req, res) => {
  const [gainers, losers] = await Promise.all([

    // ✅ Gainers — from top 1000 coins, sorted change24h high → low
    Crypto.find({
      rank:            { $gte: 1, $lte: 1000 },  // top 1000 only
      change24h:       { $gt: 0 },               // positive change
    })
      .sort({ change24h: -1 })                   // highest % first
      .limit(10)
      .select('coinId coinName symbol image rank price change24h marketCap volume24h')
      .lean(),

    // ✅ Losers — from top 1000 coins, sorted change24h low → high
    Crypto.find({
      rank:            { $gte: 1, $lte: 1000 },  // top 1000 only
      change24h:       { $lt: 0 },               // negative change
    })
      .sort({ change24h: 1 })                    // biggest loss first
      .limit(10)
      .select('coinId coinName symbol image rank price change24h marketCap volume24h')
      .lean(),

  ]);


  res.json({ success:true, gainers, losers });
});

export const getCoin = asyncHandler(async (req, res) => {
  const [coin, sentiment, trust] = await Promise.all([
    Crypto.findOne({ coinId: req.params.id }).lean(),
    Sentiment.findOne({ coinId: req.params.id }).lean(),
    TrustScore.findOne({ coinId: req.params.id }).lean(),
  ]);
  if (!coin) throw ApiError.notFound(`Coin '${req.params.id}' not found`);
  res.json({ success:true, coin, sentiment, trustScore: trust });
});


export const getMarketChart = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { days = 30, currency = 'usd' } = req.query;

  const VALID = ['usd', 'inr', 'eur', 'gbp'];
  const vs_currency = VALID.includes(currency) ? currency : 'usd';

  const url = new URL(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`);
  url.searchParams.set('vs_currency', vs_currency);
  url.searchParams.set('days', String(days));
  if (+days > 1) url.searchParams.set('interval', 'daily');
  if (process.env.COINGECKO_API_KEY)
    url.searchParams.set('x_cg_demo_api_key', process.env.COINGECKO_API_KEY);

  const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (response.status === 429) throw ApiError.rateLimit('CoinGecko rate limit');
  if (!response.ok) throw ApiError.internal(`Chart error ${response.status}`);

  const data = await response.json();
  res.json({
    success: true,
    currency: vs_currency,
    prices:       data.prices        || [],
    marketCaps:   data.market_caps   || [],
    totalVolumes: data.total_volumes || [],
  });
});
