import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate }   from 'react-router-dom';
import {
  fetchCoins, fetchGlobalStats,
  fetchTrending, fetchGainersLosers,
} from '../api/coins';
import { toggleWishlist, getWishlist } from '../api/user';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth }     from '../context/AuthContext';
import '../styles/global.css';
import '../styles/home.css';

const PctBadge = ({ value }) => {
  if (value == null) return <span className="pct-badge neu">—</span>;
  const cls = value > 0 ? 'pos' : value < 0 ? 'neg' : 'neu';
  return (
    <span className={`pct-badge ${cls}`}>
      {value > 0 ? '▲' : value < 0 ? '▼' : ''} {Math.abs(value).toFixed(2)}%
    </span>
  );
};

const fmtNum = (n, currency) => {
  if (n == null) return '—';
  const sym = { usd:'$', inr:'₹', eur:'€', gbp:'£' }[currency] || '$';
  if (n >= 1e12) return `${sym}${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `${sym}${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `${sym}${(n/1e6).toFixed(2)}M`;
  return `${sym}${n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:6})}`;
};

export default function Home() {
  const { currency }     = useCurrency();
  const { isAuth }       = useAuth();
  const navigate         = useNavigate();

  const [globalStats, setGlobalStats] = useState(null);
  const [trending,    setTrending]    = useState([]);
  const [gainers,     setGainers]     = useState([]);
  const [losers,      setLosers]      = useState([]);
  const [coins,       setCoins]       = useState([]);
  const [wishlist,    setWishlist]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [sortBy,      setSortBy]      = useState('rank');
  const [sortDir,     setSortDir]     = useState('asc');
  const [tab,         setTab]         = useState('all');

  // ✅ FIX 1: helper to pull per-currency stats safely
  const gs = (key) => globalStats?.stats?.[currency]?.[key];

  useEffect(() => {
    Promise.all([
      fetchGlobalStats(),
      fetchTrending(),
      fetchGainersLosers(),
    ]).then(([statsRes, trRes, glRes]) => {
      setGlobalStats(statsRes.data);
      setTrending(trRes.data.coins   || []);
      setGainers(glRes.data.gainers  || []);
      setLosers(glRes.data.losers    || []);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isAuth) return;
    getWishlist().then(r => setWishlist(r.data.wishlist || [])).catch(() => {});
  }, [isAuth]);

  // ✅ FIX 2: sort columns use dynamic currency (price.usd → price.inr etc.)
  const loadCoins = useCallback(() => {
    setLoading(true);
    // Remap currency-aware sort keys
    const resolvedSortBy = ['price','marketCap','volume24h'].some(k => sortBy.startsWith(k))
      ? `${sortBy.split('.')[0]}.${currency}`
      : sortBy;

    fetchCoins({ page, limit: 100, search, sortBy: resolvedSortBy, sortDir, currency })
      .then(r => {
        setCoins(r.data.coins || []);
        setTotalPages(r.data.pages || 1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search, sortBy, sortDir, currency]);

  useEffect(() => { loadCoins(); }, [loadCoins]);
  useEffect(() => { setPage(1); }, [search]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const handleWishlist = async (e, coinId) => {
    e.stopPropagation();
    if (!isAuth) { navigate('/login'); return; }
    try {
      const r = await toggleWishlist(coinId);
      setWishlist(r.data.wishlist);
    } catch (err) {
      alert(err.response?.data?.message || 'Wishlist error');
    }
  };

  // ✅ FIX 3: gainers/losers tabs use their own state — not client-side filter
  const displayCoins =
    tab === 'gainers' ? gainers :
    tab === 'losers'  ? losers  :
    coins;

  const SortIcon = ({ col }) => sortBy === col
    ? <span style={{ color:'var(--accent)' }}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
    : null;

  return (
    <div>
      {/* ── Global Stats Ticker ─────────────────────────────── */}
      {globalStats && (
        <div className="global-ticker">
          <div className="container">
            <div className="global-ticker-inner">
              <span>Cryptos:</span>
              {/* ✅ FIX 4: activeCoins is top-level (not in stats) — correct */}
              <strong>{globalStats.activeCoins?.toLocaleString()}</strong>
              <span>·</span>
              <span>Market Cap:</span>
              {/* ✅ FIX 5: use gs() helper for per-currency values */}
              <strong>{fmtNum(gs('totalMarketCap'), currency)}</strong>
              <span
                style={{
                  color: globalStats.marketCapChange24h >= 0 ? 'var(--green)' : 'var(--red)',
                  fontWeight: 600
                }}
              >
                {globalStats.marketCapChange24h >= 0 ? '▲' : '▼'}
                {Math.abs(globalStats.marketCapChange24h || 0).toFixed(1)}%
              </span>
              <span>·</span>
              <span>24h Vol:</span>
              <strong>{fmtNum(gs('totalVolume24h'), currency)}</strong>
              <span>·</span>
              <span>BTC Dom:</span>
              <strong>{gs('btcDominance')?.toFixed(1)}%</strong>
              <span>·</span>
              <span>ETH Dom:</span>
              <strong>{gs('ethDominance')?.toFixed(1)}%</strong>
            </div>
          </div>
        </div>
      )}

      <div className="container" style={{ paddingTop:'28px' }}>

        {/* ── Global Stats Cards ──────────────────────────────── */}
        {globalStats && (
          <div className="cards-row fade-in">
            <div className="global-stat-card">
              <div className="gsc-label">Total Market Cap</div>
              <div className="gsc-value">{fmtNum(gs('totalMarketCap'), currency)}</div>
              <div className={`gsc-change ${globalStats.marketCapChange24h >= 0 ? 'text-green':'text-red'}`}>
                {globalStats.marketCapChange24h >= 0 ? '▲' : '▼'}
                {Math.abs(globalStats.marketCapChange24h || 0).toFixed(2)}%
                <span style={{ color:'var(--text-muted)', fontSize:'11px' }}> 24h</span>
              </div>
            </div>

            <div className="global-stat-card">
              <div className="gsc-label">24h Volume</div>
              <div className="gsc-value">{fmtNum(gs('totalVolume24h'), currency)}</div>
              <div className="gsc-sub">Global trading activity</div>
            </div>

            <div className="global-stat-card">
              <div className="gsc-label">BTC Dominance</div>
              <div className="gsc-value">{gs('btcDominance')?.toFixed(1)}%</div>
              <div className="gsc-sub">
                BTC: {fmtNum(
                  trending.find(c => c.coinId === 'bitcoin')?.price?.[currency] ?? gs('btcPrice'),
                  currency
                )}
              </div>
            </div>

            <div className="global-stat-card">
              <div className="gsc-label">ETH Dominance</div>
              <div className="gsc-value">{gs('ethDominance')?.toFixed(1)}%</div>
              <div className="gsc-sub">
                ETH: {fmtNum(
                  trending.find(c => c.coinId === 'ethereum')?.price?.[currency] ?? gs('ethPrice'),
                  currency
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Trending + Gainers ──────────────────────────────── */}
        <div className="two-col-grid">
          {/* Trending */}
          <div className="mini-card fade-in">
            <div className="mini-card-header"><h3>🔥 Trending</h3></div>
            {trending.slice(0, 7).map((c, i) => (
              <Link to={`/coin/${c.coinId}`} key={c.coinId} className="mini-coin-row">
                <span className="mini-rank">{i + 1}</span>
                <img src={c.image} alt={c.coinName} className="mini-coin-img"
                  onError={e => { e.target.src = 'https://via.placeholder.com/28'; }} />
                <div className="mini-coin-name">
                  <strong>{c.coinName}</strong>
                  <span>{c.symbol}</span>
                </div>
                <div className="mini-coin-price">
                  <strong>{fmtNum(c.price?.[currency], currency)}</strong>
                  <span className={c.change24h >= 0 ? 'text-green' : 'text-red'}>
                    {c.change24h >= 0 ? '+' : ''}{c.change24h?.toFixed(2)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Top Gainers / Losers */}
          <div className="mini-card fade-in">
            <div className="mini-card-header">
              <h3>🚀 Top Gainers <span style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:400 }}>24h</span></h3>
            </div>
            {gainers.slice(0, 7).map((c, i) => (
              <Link to={`/coin/${c.coinId}`} key={c.coinId} className="mini-coin-row">
                <span className="mini-rank">{i + 1}</span>
                <img src={c.image} alt={c.coinName} className="mini-coin-img"
                  onError={e => { e.target.src = 'https://via.placeholder.com/28'; }} />
                <div className="mini-coin-name">
                  <strong>{c.coinName}</strong>
                  <span>{c.symbol}</span>
                </div>
                <div className="mini-coin-price">
                  <strong>{fmtNum(c.price?.[currency], currency)}</strong>
                  <span className="text-green">+{c.change24h?.toFixed(2)}%</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Main Coin Table ─────────────────────────────────── */}
        <div className="table-section">
          <div className="table-controls">
            <div className="table-tabs">
              {[
                { key:'all',     label:'All Coins' },
                
              ].map(t => (
                <button
                  key={t.key}
                  className={`table-tab ${tab === t.key ? 'active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="search-input-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                placeholder="Search coins..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="coin-table-wrapper">
            <table className="coin-table">
              <thead>
                <tr>
                  <th style={{ width:'40px' }}>#</th>
                  <th onClick={() => handleSort('coinName')}>Name <SortIcon col="coinName" /></th>
                  <th className="right" onClick={() => handleSort('price')}>Price <SortIcon col="price" /></th>
                  <th className="right hide-mobile" onClick={() => handleSort('change1h')}>1h % <SortIcon col="change1h" /></th>
                  <th className="right" onClick={() => handleSort('change24h')}>24h % <SortIcon col="change24h" /></th>
                  <th className="right hide-mobile" onClick={() => handleSort('change7d')}>7d % <SortIcon col="change7d" /></th>
                  <th className="right hide-mobile" onClick={() => handleSort('marketCap')}>Market Cap <SortIcon col="marketCap" /></th>
                  <th className="right hide-mobile" onClick={() => handleSort('volume24h')}>Volume 24h <SortIcon col="volume24h" /></th>
                  {/* ✅ FIX 7: Trust score td was missing in tbody — now both match */}
                  <th style={{ width:'40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 10 }).map((_, j) => (
                          <td key={j}>
                            <div className="skeleton" style={{ height:'16px', width: j===1?'120px':'60px' }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : displayCoins.map((coin, idx) => (
                      <tr key={coin.coinId} onClick={() => navigate(`/coin/${coin.coinId}`)}>
                        <td style={{ color:'var(--text-muted)', fontWeight:500 }}>{coin.rank || idx + 1}</td>
                        <td>
                          <div className="coin-name-cell">
                            <img src={coin.image} alt={coin.coinName}
                              onError={e => { e.target.src='https://via.placeholder.com/28'; }} />
                            <div>
                              <div className="name">{coin.coinName}</div>
                              <div className="symbol">{coin.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className="right" style={{ fontWeight:600 }}>
                          {fmtNum(coin.price?.[currency], currency)}
                        </td>
                        <td className="right hide-mobile"><PctBadge value={coin.change1h} /></td>
                        <td className="right"><PctBadge value={coin.change24h} /></td>
                        <td className="right hide-mobile"><PctBadge value={coin.change7d} /></td>
                        <td className="right hide-mobile">{fmtNum(coin.marketCap?.[currency], currency)}</td>
                        <td className="right hide-mobile">{fmtNum(coin.volume24h?.[currency], currency)}</td>
                        
                        <td>
                          <button
                            className={`wishlist-btn ${wishlist.includes(coin.coinId) ? 'active' : ''}`}
                            onClick={e => handleWishlist(e, coin.coinId)}
                            title={wishlist.includes(coin.coinId) ? 'Remove from watchlist' : 'Add to watchlist'}
                          >
                            {wishlist.includes(coin.coinId) ? '★' : '☆'}
                          </button>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>

            {/* Pagination — only show on All tab */}
            {tab === 'all' && (
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = page <= 3 ? i + 1 : page - 2 + i;
                  if (p > totalPages) return null;
                  return (
                    <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  );
                })}
                <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
