import Crypto from '../models/Crypto.js';

const BASE_URL = 'https://api.coingecko.com/api/v3';

// ── API Keys — filter undefined at module load ────────────────────────────
const API_KEYS = [
  process.env.COINGECKO_API_KEY,
  
  process.env.COINGECKO_API_KEY5,
].filter(k => k && k !== 'undefined');


let conversionRates = { usd: 1, inr: 83.5, eur: 0.92, gbp: 0.79 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ════════════════════════════════════════════════════════════════
// CORE FETCH — retry limit + undefined key guard
// ════════════════════════════════════════════════════════════════
const cgFetch = async (endpoint, params = {}, apiKey, retries = 0) => {
  try {
    const url = new URL(`${BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

    // ✅ Only append key if valid — prevents ?x_cg_demo_api_key=undefined
    if (apiKey && apiKey !== 'undefined') {
      url.searchParams.append('x_cg_demo_api_key', apiKey);
    }

    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
    });

    // ✅ Max 3 retries — prevents infinite recursion
    if (res.status === 429) {
      if (retries >= 3) {
        console.warn(`  Max retries reached for ${endpoint}`);
        return null;
      }
      console.warn(`  Rate limited — waiting 60s... (attempt ${retries + 1}/3)`);
      await sleep(60000);
      return cgFetch(endpoint, params, apiKey, retries + 1);
    }

    if (!res.ok) {
      console.warn(`CoinGecko ${res.status}: ${endpoint}`);
      return null;
    }

    return res.json();
  } catch (err) {
    console.error(`cgFetch error (${endpoint}):`, err.message);
    return null;
  }
};

// ════════════════════════════════════════════════════════════════
// EXCHANGE RATES — tries all keys until one works
// ════════════════════════════════════════════════════════════════
export const updateExchangeRates = async () => {
  let data = null;

  for (const key of API_KEYS) {
    data = await cgFetch('/simple/price', {
      ids:           'bitcoin',
      vs_currencies: 'usd,inr,eur,gbp',
    }, key);
    if (data?.bitcoin?.usd) break;
    console.warn(`  Key ${key.slice(0, 10)}... failed — trying next`);
  }

  if (!data?.bitcoin?.usd) {
    console.warn('  All keys failed — using cached rates');
    return;
  }

  const btc = data.bitcoin;
  conversionRates = {
    usd: 1,
    inr: btc.inr / btc.usd,
    eur: btc.eur / btc.usd,
    gbp: btc.gbp / btc.usd,
  };
};

export const getConversionRates = () => conversionRates;

const toCurrencies = (usdVal) => ({
  usd: usdVal,
  inr: usdVal * conversionRates.inr,
  eur: usdVal * conversionRates.eur,
  gbp: usdVal * conversionRates.gbp,
});

// ════════════════════════════════════════════════════════════════
// COIN DETAIL
// ════════════════════════════════════════════════════════════════
const fetchCoinDetail = async (coinId) => {
  return cgFetch(`/coins/${coinId}`, {
    localization:   'false',
    tickers:        'false',
    market_data:    'true',
    community_data: 'false',
    developer_data: 'false',
  }, API_KEYS[0]);
};

// ════════════════════════════════════════════════════════════════
// PROCESS ONE PAGE — upsert to MongoDB
// ════════════════════════════════════════════════════════════════
const processCoinBatch = async (pageNumber, apiKey) => {
  const coinsData = await cgFetch('/coins/markets', {
    vs_currency:             'usd',
    order:                   'market_cap_desc',
    per_page:                250,
    page:                    pageNumber,
    sparkline:               false,
    price_change_percentage: '1h,24h,7d',
  }, apiKey);

  if (!coinsData?.length) return false;

  const bulkOps = coinsData
    .filter(c => c.market_cap && c.market_cap > 0)
    .map((c, i) => {
      const priceUsd = c.current_price           || 0;
      const mcapUsd  = c.market_cap              || 0;
      const volUsd   = c.total_volume            || 0;
      const fdvUsd   = c.fully_diluted_valuation || 0;

      return {
        updateOne: {
          filter: { coinId: c.id },
          update: {
            $set: {
              coinId:   c.id,
              coinName: c.name,
              symbol:   c.symbol,
              image:    c.image,
              rank:     c.market_cap_rank ?? ((pageNumber - 1) * 250 + i + 1),
              price:     toCurrencies(priceUsd),
              marketCap: toCurrencies(mcapUsd),
              volume24h: toCurrencies(volUsd),
              fdv:       toCurrencies(fdvUsd),
              priceRange: {
                high24h: toCurrencies(c.high_24h || 0),
                low24h:  toCurrencies(c.low_24h  || 0),
              },
              mcapToFdv: fdvUsd > 0
                ? parseFloat((mcapUsd / fdvUsd).toFixed(4))
                : null,
              change1h:  c.price_change_percentage_1h_in_currency || 0,
              change24h: c.price_change_percentage_24h             || 0,
              change7d:  c.price_change_percentage_7d_in_currency  || 0,
              circulatingSupply: c.circulating_supply,
              totalSupply:       c.total_supply,
              maxSupply:         c.max_supply,
              lastSyncedAt:      new Date(),
            },
          },
          upsert: true,
        },
      };
    });

  if (bulkOps.length > 0) await Crypto.bulkWrite(bulkOps);
  return true;
};

// ════════════════════════════════════════════════════════════════
// DEEP FIELDS — 14d / 30d / 1y — rotates keys per batch
// ════════════════════════════════════════════════════════════════
export const updateDeepFields = async (topN = 500) => {
  const coins = await Crypto.find({})
    .sort({ rank: 1 })
    .limit(topN)
    .select('coinId')
    .lean();

  const BATCH = 250;

  for (let i = 0; i < coins.length; i += BATCH) {
    const batch = coins.slice(i, i + BATCH);
    const ids   = batch.map(c => c.coinId).join(',');

    const key = API_KEYS[(i / BATCH) % API_KEYS.length];

    const data = await cgFetch('/coins/markets', { 
      vs_currency:             'usd',
      ids,
      price_change_percentage: '14d,30d,1y',
      per_page:                BATCH,
      page:                    1,
    }, key);

    if (!data?.length) { await sleep(3000); continue; }

    const bulkOps = data.map(coin => ({
      updateOne: {
        filter: { coinId: coin.id },
        update: {
          $set: {
            change14d: coin.price_change_percentage_14d_in_currency || 0,
            change30d: coin.price_change_percentage_30d_in_currency || 0,
            change1y:  coin.price_change_percentage_1y_in_currency  || 0,
          },
        },
      },
    }));

    await Crypto.bulkWrite(bulkOps);
    await sleep(2000);
  }

  console.log(`Deep fields updated for top ${topN} coins`);
};

// ════════════════════════════════════════════════════════════════
// TOP 1000 COINS — pages 1–4, rotates keys per page
// ════════════════════════════════════════════════════════════════
export const updateTopCoins = async () => {
  await updateExchangeRates();

  for (let page = 1; page <= 4; page++) {
    const key = API_KEYS[(page - 1) % API_KEYS.length];
    await processCoinBatch(page, key);
    await sleep(1000);
  }

  console.log(' Top 1000 coins updated');
};

// ════════════════════════════════════════════════════════════════
// DEEP MARKET — pages 5–55, rotates keys + retries on failure
// ════════════════════════════════════════════════════════════════
export const updateDeepMarket = async () => {
  if (!API_KEYS.length) {
    console.error('  No valid API keys — skipping deep market');
    return;
  }

  let currentPage = 5;
  let keyIndex    = 0;
  let failCount   = 0; // ✅ consecutive fail counter per page

  while (currentPage <= 55) {
    const key     = API_KEYS[keyIndex % API_KEYS.length];
    const success = await processCoinBatch(currentPage, key);

    if (!success) {
      failCount++;
      keyIndex++; // ✅ try next key before giving up

      if (failCount >= API_KEYS.length) {
        console.log(`  All keys failed at page ${currentPage} — stopping`);
        break;
      }
      console.log(`  Page ${currentPage} failed — retrying with next key...`);
      continue; // retry same page with next key
    }

    failCount = 0; // ✅ reset on success
    currentPage++;
    keyIndex++;
    await sleep(12000); // 12s — safe for demo tier (30 calls/min)
  }

  console.log(' Deep market updated');
};
