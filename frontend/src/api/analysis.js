const buildPrompt = (coin, currency) => {
  const sym = { usd:'$', inr:'₹', eur:'€', gbp:'£' }[currency] || '$';
  const fmt = (n) => {
    if (!n) return '—';
    if (n >= 1e12) return `${sym}${(n/1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `${sym}${(n/1e9).toFixed(2)}B`;
    if (n >= 1e6)  return `${sym}${(n/1e6).toFixed(2)}M`;
    return `${sym}${n.toLocaleString()}`;
  };

  return `You are a professional crypto market analyst for CryptosDen.
Analyze ${coin.coinName} (${coin.symbol?.toUpperCase()}) using the market data below.
Search the web for the most recent news and events about this coin.

Market Data:
- Price: ${fmt(coin.price?.[currency])}
- 1h: ${coin.change1h?.toFixed(2)}% | 24h: ${coin.change24h?.toFixed(2)}% | 7d: ${coin.change7d?.toFixed(2)}% | 30d: ${coin.change30d?.toFixed(2)}%
- Market Cap: ${fmt(coin.marketCap?.[currency])} | Volume 24h: ${fmt(coin.volume24h?.[currency])}
- Rank: #${coin.rank}

Respond in this EXACT format with these exact labels:

SUMMARY:
[2-3 sentences about what has recently happened with price and market movement]

NEWS:
[2-3 sentences about the most recent news, developments, partnerships, or events]

SENTIMENT:
[Exactly one word: Bullish OR Bearish OR Neutral]

Keep it concise and factual. No financial advice.`;
};

export const getCoinAnalysis = async (coin, currency) => {
  if (!window.puter?.ai) throw new Error('Puter.js not loaded. Please refresh the page.');

  const response = await window.puter.ai.chat(
    buildPrompt(coin, currency),
    { model: 'gpt-5.3-chat' }
  );

  const raw =
    response?.message?.content ||
    response?.content           ||
    (typeof response === 'string' ? response : '');

  if (!raw) throw new Error('No analysis returned');

  // Parse structured response
  const get = (label) => {
    const match = raw.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z]+:|$)`));
    return match?.[1]?.trim() || '';
  };

  return {
    summary:   get('SUMMARY'),
    news:      get('NEWS'),
    sentiment: get('SENTIMENT')?.toLowerCase().includes('bull') ? 'bullish'
             : get('SENTIMENT')?.toLowerCase().includes('bear') ? 'bearish'
             : 'neutral',
    raw,
  };
};
