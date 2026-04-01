import { useState, useEffect } from 'react';
import { getWishlist }         from '../api/user';
import { fetchCoin }           from '../api/coins';  // ← changed: fetchCoin not fetchCoins
import { useCurrency }         from '../context/CurrencyContext';
import { Link }                from 'react-router-dom';

const fmtNum = (n, currency) => {
  if (n == null) return '—';
  const sym = { usd:'$', inr:'₹', eur:'€', gbp:'£' }[currency] || '$';
  if (n >= 1e12) return `${sym}${(n/1e12).toFixed(3)}T`;
  if (n >= 1e9)  return `${sym}${(n/1e9).toFixed(3)}B`;
  if (n >= 1e6)  return `${sym}${(n/1e6).toFixed(3)}M`;
  return `${sym}${n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:6})}`;
};

export default function Watchlist() {
  const { currency }                  = useCurrency();
  const [wishlistIds, setWishlistIds] = useState([]);
  const [coins,       setCoins]       = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Step 1 — get saved coin IDs from backend
        const wlRes = await getWishlist();
        const ids   = wlRes.data.wishlist || [];
        setWishlistIds(ids);

        if (ids.length === 0) {
          setCoins([]);
          return;
        }

        // Step 2 — fetch each coin individually by ID (works for ANY rank)
        const results = await Promise.allSettled(ids.map(id => fetchCoin(id)));

        const loaded = results
          .filter(r => r.status === 'fulfilled')
          .map(r => r.value.data.coin);

        setCoins(loaded);
      } catch (err) {
        console.error('Watchlist load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currency]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop:'40px' }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} className="skeleton"
            style={{ height:'52px', marginBottom:'8px', borderRadius:'8px' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop:'24px', paddingBottom:'60px' }}>

      {/* Header */}
      <div style={{ marginBottom:'20px' }}>
        <h1 className="section-title">
          My Watchlist
          <span>  coin{coins.length !== 1 ? 's' : ''}</span>
        </h1>
      </div>

      {/* Empty state */}
      {coins.length === 0 && (
        <div style={{
          textAlign:  'center',
          padding:    '60px 20px',
          background: 'var(--bg-card)',
          border:     '1px solid var(--border)',
          borderRadius:'var(--radius)',
        }}>
          <div style={{ fontSize:'48px', marginBottom:'12px' }}>☆</div>
          <h3 style={{ marginBottom:'8px' }}>No coins in your watchlist</h3>
          <p style={{ color:'var(--text-muted)', marginBottom:'20px' }}>
            Go to a coin page and click ☆ to add it here.
          </p>
          <Link to="/" className="btn btn-primary">Browse Markets</Link>
        </div>
      )}

      {/* Coin Table */}
      {coins.length > 0 && (
        <div className="coin-table-wrapper">
          <table className="coin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Coin</th>
                <th className="right">Price</th>
                <th className="right">24h</th>
                <th className="right">7d</th>
                <th className="right">Market Cap</th>
                <th className="right">Volume 24h</th>
                <th className="right">Alert</th>
              </tr>
            </thead>
            <tbody>
              {coins.map((coin, idx) => {
                const change24h = coin.change24h;
                const change7d  = coin.change7d;
                return (
                  <tr key={coin.coinId}>
                    <td style={{ color:'var(--text-muted)', fontSize:'13px' }}>
                      {coin.rank || idx + 1}
                    </td>
                    <td>
                      <Link
                        to={`/coin/${coin.coinId}`}
                        className="coin-name-cell"
                        style={{ textDecoration:'none', color:'inherit' }}
                      >
                        <img
                          src={coin.image}
                          alt={coin.coinName}
                          onError={e => { e.target.src='https://via.placeholder.com/32'; }}
                        />
                        <div>
                          <div className="name">{coin.coinName}</div>
                          <div className="symbol">{coin.symbol}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="right" style={{ fontWeight:700 }}>
                      {fmtNum(coin.price?.[currency], currency)}
                    </td>
                    <td className="right">
                      <span className={`pct-badge ${change24h >= 0 ? 'pos' : 'neg'}`}>
                        {change24h >= 0 ? '▲' : '▼'} {Math.abs(change24h||0).toFixed(2)}%
                      </span>
                    </td>
                    <td className="right">
                      <span className={`pct-badge ${change7d >= 0 ? 'pos' : 'neg'}`}>
                        {change7d >= 0 ? '▲' : '▼'} {Math.abs(change7d||0).toFixed(2)}%
                      </span>
                    </td>
                    <td className="right" style={{ color:'var(--text-secondary)' }}>
                      {fmtNum(coin.marketCap?.[currency], currency)}
                    </td>
                    <td className="right" style={{ color:'var(--text-secondary)' }}>
                      {fmtNum(coin.volume24h?.[currency], currency)}
                    </td>
                    <td className="right">
                      <span style={{
                        fontSize:'11px', fontWeight:600,
                        color:'var(--green)',
                        background:'var(--green-bg)',
                        padding:'3px 8px',
                        borderRadius:'20px',
                        border:'1px solid var(--green-border)',
                      }}>
                        🔔 Active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
