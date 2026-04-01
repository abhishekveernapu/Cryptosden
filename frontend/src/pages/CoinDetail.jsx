import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchCoin, fetchMarketChart } from '../api/coins';
import { getPrediction }               from '../api/predictions';
import { toggleWishlist, getWishlist } from '../api/user';
import { useCurrency }  from '../context/CurrencyContext';
import { useAuth }      from '../context/AuthContext';
import { getCoinAnalysis } from '../api/analysis';
import '../styles/global.css';
import '../styles/coinDetail.css';
import '../styles/aiAnalysis.css';
import {
  Chart,
  LineElement, PointElement, LineController,
  CategoryScale, LinearScale,
  Filler, Tooltip, Legend,
} from 'chart.js';


Chart.register(
  LineElement, PointElement, LineController,
  CategoryScale, LinearScale,
  Filler, Tooltip, Legend
);

// Add this near the top of your CoinDetail component file
const getCssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#ffffff';



const RANGES = [
  { label:'24h', days:1   },
  { label:'7d',  days:7   },
  { label:'30d', days:30  },
  { label:'90d', days:90  },
  { label:'1y',  days:365 },
];

const fmtNum = (n, currency) => {
  if (n == null) return '—';
  const sym = { usd:'$', inr:'₹', eur:'€', gbp:'£' }[currency] || '$';
  if (n >= 1e12) return `${sym}${(n/1e12).toFixed(3)}T`;
  if (n >= 1e9)  return `${sym}${(n/1e9).toFixed(3)}B`;
  if (n >= 1e6)  return `${sym}${(n/1e6).toFixed(3)}M`;
  if (n >= 1)    return `${sym}${n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:6})}`;
  return `${sym}${n.toFixed(10).replace(/\.?0+$/, '')}`;
};

const ChangeChip = ({ value, label }) => {
  if (value == null) return null;
  return (
    <span className={`change-chip ${value >= 0 ? 'pos' : 'neg'}`}>
      {value >= 0 ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
      <span className="period"> {label}</span>
    </span>
  );
};

const ScoreBar = ({ score, label, colors }) => {
  const color = score >= 75 ? colors[0] : score >= 50 ? colors[1] : score >= 25 ? colors[2] : colors[3];
  return (
    <div>
      <div className="score-row" style={{ marginBottom:'8px' }}>
        <span className="score-number" style={{ color }}>{score?.toFixed(0) ?? '—'}</span>
        <span style={{ fontSize:'13px', color:'var(--text-secondary)', fontWeight:500 }}>{label}</span>
      </div>
      <div className="score-meter">
        <div className="score-meter-fill" style={{ width:`${score || 0}%`, background: color }} />
      </div>
    </div>
  );
};

export default function CoinDetail() {
  const { id }       = useParams();
  const { currency } = useCurrency();
  const { isAuth }   = useAuth();
  const navigate     = useNavigate();

  // ── ALL useState ──────────────────────────────────────────────
  const [coin,         setCoin]         = useState(null);
  const [sentiment,    setSentiment]    = useState(null);
  const [trustScore,   setTrustScore]   = useState(null);
  const [prediction,   setPrediction]   = useState(null);
  const [wishlist,     setWishlist]     = useState([]);
  const [range,        setRange]        = useState(30);
  const [loading,      setLoading]      = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [aiData,       setAiData]       = useState(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiError,      setAiError]      = useState('');

  // ── ALL useRef ────────────────────────────────────────────────
  const priceChartRef = useRef(null);
  const mcapChartRef  = useRef(null);
  const priceChart    = useRef(null);
  const mcapChart     = useRef(null);
  const aiLoadingRef  = useRef(false); // ✅ Fix 2 — tracks in-flight AI call

  // ── Helper ────────────────────────────────────────────────────
  const getCssVar = (v) =>
    getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // ── generateAnalysis ─────────────────────────────────────────
  // ✅ Fix 2 — uses aiLoadingRef instead of stale aiLoading state
  const generateAnalysis = async (coinData) => {
    const target = coinData || coin;
    if (!target || aiLoadingRef.current) return;
    aiLoadingRef.current = true;
    setAiLoading(true);
    setAiError('');
    setAiData(null);
    try {
      const result = await getCoinAnalysis(target, currency);
      setAiData(result);
    } catch (err) {
      setAiError(err?.message || 'Analysis failed. Please try again.');
    } finally {
      aiLoadingRef.current = false;
      setAiLoading(false);
    }
  };

  // ── useEffect 1 — Load coin + prediction + wishlist ───────────
  // — currency in deps so analysis reruns on currency switch
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchCoin(id),
      isAuth ? getPrediction(id).catch(() => null) : Promise.resolve(null),
      isAuth ? getWishlist().catch(() => null)      : Promise.resolve(null),
    ]).then(([coinRes, predRes, wlRes]) => {
      const coinData = coinRes.data.coin;
      setCoin(coinData);
      setSentiment(coinRes.data.sentiment);
      setTrustScore(coinRes.data.trustScore);
      if (predRes) setPrediction(predRes.data.prediction);
      if (wlRes)   setWishlist(wlRes.data.wishlist || []);
      if (isAuth && coinData) generateAnalysis(coinData);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id, isAuth, currency]); // ✅ currency added

  // ── useEffect 2 — Charts ──────────────────────────────────────
  useEffect(() => {
  if (!coin) return;

  const destroyChart = (canvasRef, chartRef) => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (canvasRef.current) {
      const ex = Chart.getChart(canvasRef.current);
      if (ex) ex.destroy();
    }
  };

  destroyChart(priceChartRef, priceChart);
  destroyChart(mcapChartRef,  mcapChart);
  setChartLoading(true);

  // ✅ Pass currency to API
  fetchMarketChart(id, range, currency).then(res => {
    const prices = res.data.prices     || [];
    const mcaps  = res.data.marketCaps || [];

    const labels = prices.map(p => {
      const d = new Date(p[0]);
      return range <= 1
        ? d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
        : d.toLocaleDateString([], { month:'short', day:'numeric' });
    });

    const priceVals = prices.map(p => p[1]);
    const mcapVals  = mcaps.map(m => m[1]);
    const isUp      = priceVals[priceVals.length - 1] >= priceVals[0];
    const lineColor = isUp ? '#3fb950' : '#f85149';

    destroyChart(priceChartRef, priceChart);
    destroyChart(mcapChartRef,  mcapChart);

    // ── Price Chart ───────────────────────────────────────────
    priceChart.current = new Chart(priceChartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data:            priceVals,
          borderColor:     lineColor,
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 280);
            g.addColorStop(0,   isUp ? 'rgba(63,185,80,0.25)' : 'rgba(248,81,73,0.25)');
            g.addColorStop(0.6, isUp ? 'rgba(63,185,80,0.05)' : 'rgba(248,81,73,0.05)');
            g.addColorStop(1,   'rgba(0,0,0,0)');
            return g;
          },
          borderWidth:2, pointRadius:0, pointHoverRadius:5,
          pointHoverBackgroundColor: lineColor,
          pointHoverBorderColor:'#fff', pointHoverBorderWidth:2,
          fill:true, tension:0.35,
        }],
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        plugins:{
          legend:{ display:false },
          tooltip:{
            enabled:true,
            backgroundColor: getCssVar('--bg-card'),
            titleColor:      getCssVar('--text-secondary'),
            bodyColor:       getCssVar('--text-primary'),
            borderColor: lineColor, borderWidth:1,
            padding:12, cornerRadius:10, displayColors:false,
            callbacks:{
              title:      (items) => items[0].label,
              // ✅ currency passed into fmtNum
              label:      (ctx)   => ` Price: ${fmtNum(ctx.raw, currency)}`,
              afterLabel: (ctx)   => {
                if (!priceVals[0]) return '';
                const diff = ctx.raw - priceVals[0];
                const pct  = ((diff / priceVals[0]) * 100).toFixed(2);
                return ` ${diff >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% from open`;
              },
            },
          },
        },
        scales:{
          x:{ border:{display:false}, grid:{color:'rgba(128,128,128,0.1)'}, ticks:{color:getCssVar('--text-muted'),font:{size:11},maxTicksLimit:7} },
          y:{ position:'right', border:{display:false}, grid:{color:'rgba(128,128,128,0.1)'},
            // ✅ Y-axis labels use current currency
            ticks:{color:getCssVar('--text-muted'),font:{size:11},callback:(v)=>fmtNum(v,currency)} },
        },
      },
    });

    // ── Market Cap Chart ──────────────────────────────────────
    mcapChart.current = new Chart(mcapChartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data:            mcapVals,
          borderColor:     'rgba(88,166,255,0.9)',
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
            g.addColorStop(0,   'rgba(88,166,255,0.3)');
            g.addColorStop(0.6, 'rgba(88,166,255,0.06)');
            g.addColorStop(1,   'rgba(88,166,255,0)');
            return g;
          },
          borderWidth:2, pointRadius:0, pointHoverRadius:5,
          pointHoverBackgroundColor:'rgba(88,166,255,1)',
          pointHoverBorderColor:'#fff', pointHoverBorderWidth:2,
          fill:true, tension:0.35,
        }],
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        plugins:{
          legend:{ display:false },
          tooltip:{
            enabled:true,
            backgroundColor: getCssVar('--bg-card'),
            titleColor:      getCssVar('--text-secondary'),
            bodyColor:       getCssVar('--text-primary'),
            borderColor:'rgba(88,166,255,0.6)', borderWidth:1,
            padding:12, cornerRadius:10, displayColors:false,
            callbacks:{
              title:      (items) => items[0].label,
              // ✅ currency passed into fmtNum
              label:      (ctx)   => ` Market Cap: ${fmtNum(ctx.raw, currency)}`,
              afterLabel: (ctx)   => {
                if (!mcapVals[0]) return '';
                const diff = ctx.raw - mcapVals[0];
                const pct  = ((diff / mcapVals[0]) * 100).toFixed(2);
                return ` ${diff >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% from open`;
              },
            },
          },
        },
        scales:{
          x:{ border:{display:false}, grid:{color:'rgba(128,128,128,0.1)'}, ticks:{color:getCssVar('--text-muted'),font:{size:11},maxTicksLimit:7} },
          y:{ position:'right', border:{display:false}, grid:{color:'rgba(128,128,128,0.1)'},
            // ✅ Y-axis labels use current currency
            ticks:{color:getCssVar('--text-muted'),font:{size:11},callback:(v)=>fmtNum(v,currency)} },
        },
      },
    });

  }).catch(console.error)
    .finally(() => setChartLoading(false));

  return () => {
    priceChart.current?.destroy();
    mcapChart.current?.destroy();
  };

// ✅ currency in dependency array — chart re-fetches when currency changes
}, [id, range, currency, coin]);


  // ── Wishlist handler ──────────────────────────────────────────
  const handleWishlist = async () => {
    if (!isAuth) { navigate('/login'); return; }
    try {
      const r = await toggleWishlist(id);
      setWishlist(r.data.wishlist);
    } catch (err) {
      alert(err.response?.data?.message || 'Wishlist error');
    }
  };

  // ── Early returns AFTER all hooks ─────────────────────────────
  if (loading) {
    return (
      <div className="container" style={{ paddingTop:'40px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          {[200,400,300].map((w,i) => (
            <div key={i} className="skeleton"
              style={{ height:'20px', width:`${w}px`, maxWidth:'100%' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!coin) {
    return (
      <div className="container" style={{ paddingTop:'60px', textAlign:'center' }}>
        <h2>Coin not found</h2>
        <Link to="/" className="btn btn-primary"
          style={{ marginTop:'16px', display:'inline-flex' }}>
          ← Back to Markets
        </Link>
      </div>
    );
  }

  const inWishlist = wishlist.includes(coin.coinId);
  const curPrice   = coin.price?.[currency];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">🏠 Home</Link>
          <span>›</span>
          <Link to="/">Markets</Link>
          <span>›</span>
          <span style={{ color:'var(--text-primary)', fontWeight:500 }}>
            {coin.coinName}
          </span>
          {coin.rank && (
            <span className="badge badge-blue" style={{ fontSize:'11px', padding:'2px 7px' }}>
              #{coin.rank}
            </span>
          )}
        </div>
      </div>

      <div className="container">
        <div className="coin-detail-layout">

          {/* ── Left Panel ──────────────────────────────────── */}
          <aside className="detail-left">

            {/* Header Card */}
            <div className="coin-header-card">
              <div className="coin-header-top">
                <img src={coin.image} alt={coin.coinName}
                  className="coin-header-img"
                  onError={e => { e.target.src='https://via.placeholder.com/56'; }} />
                <div className="coin-header-name">
                  <h1>{coin.coinName}</h1>
                  <span className="symbol-badge">{coin.symbol}</span>
                </div>
                <button onClick={handleWishlist}
                  className={`wishlist-btn ${inWishlist ? 'active' : ''}`}
                  style={{ fontSize:'22px', marginLeft:'auto' }}>
                  {inWishlist ? '★' : '☆'}
                </button>
              </div>

              <div className="coin-price-main">{fmtNum(curPrice, currency)}</div>

              <div className="coin-price-changes">
                <ChangeChip value={coin.change1h}  label="1h"  />
                <ChangeChip value={coin.change24h} label="24h" />
                <ChangeChip value={coin.change7d}  label="7d"  />
              </div>

            
              <div className="coin-stats-grid">
              {[
                { 
                  label:'Market Cap', 
                  value: fmtNum(coin.marketCap?.[currency], currency),
                  tooltip: 'Total value of circulating supply\n\nFormula:\nCirculating Supply × Current Price'
                },
                { 
                  label:'24h Volume', 
                  value: fmtNum(coin.volume24h?.[currency], currency),
                  tooltip: 'Total trading volume\nacross all exchanges\nin last 24 hours'
                },
                { 
                  label:'FDV', 
                  value: fmtNum(coin.fdv?.[currency], currency),
                  tooltip: 'Fully Diluted Valuation\n\nFormula:\nTotal/Max Supply × Current Price\n\nShows potential market cap if fully diluted'
                },
                { 
                  label:'MC / FDV', 
                  value: coin.mcapToFdv != null ? coin.mcapToFdv.toFixed(3) : '—',
                  tooltip: 'Market Cap ÷ Fully Diluted Valuation\n\n• <0.2: Heavy dilution risk\n• 0.2-0.5: Moderate\n• >0.5: Low dilution risk'
                },
                { 
                  label:'Circulating Supply', 
                  value: coin.circulatingSupply ? `${(coin.circulatingSupply/1e6).toFixed(2)}M` : '—',
                  tooltip: 'Coins available to public\nfor trading\n\nExcludes:\n• Locked tokens\n• Team allocations\n• Vesting schedules'
                },
                { 
                  label:'Total Supply', 
                  value: coin.totalSupply ? `${(coin.totalSupply/1e6).toFixed(2)}M` : '—',
                  tooltip: 'All coins/tokens created\n\nIncludes:\n• Circulating supply\n• Locked tokens\n• Future unlocks'
                },
                { 
                  label:'Max Supply', 
                  value: coin.maxSupply ? `${(coin.maxSupply/1e6).toFixed(2)}M` : '∞',
                  tooltip: 'Maximum coins that will\nEVER exist\n\n∞ = No hard cap\n(inflationary token)'
                },
                { 
                  label:'24h Range', 
                  value: coin.priceRange ? `${fmtNum(coin.priceRange.low24h?.[currency],currency)} – ${fmtNum(coin.priceRange.high24h?.[currency],currency)}` : '—',
                  tooltip: 'Lowest ↔ Highest price\nreached in last 24h\n\nShows daily volatility'
                },
              ].map(r => (
                <div key={r.label} className="coin-stat-row">
                  <span className="label info-tooltip" data-tooltip={r.tooltip}>
                    {r.label} <span className="info-icon">i</span>
                  </span>
                  <span className="value">{r.value}</span>
                </div>
              ))}
            </div>




            </div>

            
            {/* Trust Score */}
            {trustScore && (
              <div className="score-card">
                <h3 className="info-tooltip header" 
                    data-tooltip="Trust Score
                      0-20: 🔴 Very Low (new/risky)
                      21-40: 🟡 Low Trust
                      41-60: 🟠 Medium 
                      61-80: 🟢 High Trust
                      81-100: 🟢 Excellent (established)">
                  🔐 Trust Score <span className="info-icon">i</span>
                </h3>
                <ScoreBar score={trustScore.score} label={trustScore.label}
                  colors={['var(--green)','var(--accent)','var(--yellow)','var(--red)']} />
                <div style={{ marginTop:'12px', display:'flex', flexDirection:'column', gap:'6px' }}>
                  {Object.entries(trustScore.breakdown || {}).map(([k, v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:'12px' }}>
                      <span style={{ color:'var(--text-muted)', textTransform:'capitalize' }}>
                        {k.replace(/([A-Z])/g,' $1')}
                      </span>
                      <span style={{ fontWeight:600 }}>{v?.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sentiment */}
            {sentiment && (
              <div className="score-card">
                <h3 className="info-tooltip header" 
                    data-tooltip="Emotional Value Index (eVI)

            Aggregates:
            • Social media sentiment
            • Google Trends
            • Reddit activity
            • Fear & Greed Index

            Ranges:
            0-39: Bearish (Fear)
            40-59: Neutral
            60-100: Bullish (Greed)">
                  😨 Sentiment (eVI) <span className="info-icon">i</span>
                </h3>
                <ScoreBar score={sentiment.eVI} label={sentiment.label}
                  colors={['var(--green)','var(--yellow)','var(--yellow)','var(--red)']} />
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'12px' }}>
                  <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                    Fear & Greed: <strong style={{ color:'var(--text-primary)' }}>
                      {sentiment.fearGreedValue} — {sentiment.fearGreedLabel}
                    </strong>
                  </span>
                  <span className={`badge ${sentiment.eVI >= 60 ? 'badge-green' : sentiment.eVI >= 40 ? 'badge-yellow' : 'badge-red'}`}
                    style={{ fontSize:'11px' }}>
                    {sentiment.label}
                  </span>
                </div>
              </div>
            )}
            
          </aside>

          {/* ── Right Panel ─────────────────────────────────── */}
          <div className="detail-right">

            {/* Price Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <span className="chart-title">📈 Price Chart</span>
                <div className="chart-range-tabs">
                  {RANGES.map(r => (
                    <button key={r.days}
                      className={`range-btn ${range === r.days ? 'active' : ''}`}
                      onClick={() => setRange(r.days)}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ position: 'relative', height: '280px', width: '100%' }}>
                {chartLoading && <div className="chart-skeleton" />}
                <canvas ref={priceChartRef} />
              </div>
            </div>

            {/* Market Cap Chart */}
            <div className="chart-card">
              <div className="chart-header">
                <span className="chart-title">📊 Market Cap</span>
              </div>
               <div style={{ position: 'relative', height: '200px', width: '100%' }}>
                  {chartLoading && <div className="chart-skeleton" />}
                  <canvas ref={mcapChartRef} />
                </div>
              
            </div>




            {/* AI Predictions */}
            {prediction && (
              <div className="prediction-card">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                  <h3 style={{ fontWeight:700, fontSize:'15px' }}>🧠 AI Price Predictions</h3>
                  <span className="ai-badge">GRU Neural Network</span>
                </div>
                <p style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'4px' }}>
                  MAPE: {prediction.mape?.toFixed(2)}% · Trained: {new Date(prediction.trainedAt).toLocaleDateString()}
                </p>
                <div className="prediction-grid">
                  {Object.entries(prediction.predictions || {}).map(([key, p]) => (
                    <div key={key} className="pred-cell">
                      <div className="pred-horizon">
                        {key==='day1'?'1 Day':key==='day7'?'7 Days':key==='day14'?'14 Days':'30 Days'}
                      </div>

                      {/* ✅ Fix 1 — multi-currency price */}
                      <div className="pred-price">
                        {fmtNum(p.price?.[currency] ?? p.price, currency)}
                      </div>

                      <span className={`pred-change ${p.change >= 0 ? 'badge-green' : 'badge-red'}`}>
                        {p.change >= 0 ? '+' : ''}{p.change?.toFixed(2)}%
                      </span>
                      <div className="pred-direction" style={{
                        color: p.direction==='Bullish'?'var(--green)':p.direction==='Bearish'?'var(--red)':'var(--text-muted)'
                      }}>
                        {p.direction==='Bullish'?'📈':p.direction==='Bearish'?'📉':'➡️'} {p.direction}
                      </div>

                      {/* ✅ Fix 1 — multi-currency CI range */}
                      <div style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'4px' }}>
                        {fmtNum(p.low95?.[currency]  ?? p.low95,  currency)} –{' '}
                        {fmtNum(p.high95?.[currency] ?? p.high95, currency)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 🤖 AI Analysis ──────────────────────────────── */}
            <div className="cg-ai-card fade-in">

              <div className="cg-ai-header">
                <div className="cg-ai-title">
                  <div className="cg-ai-title-icon">🤖</div>
                  Recently Happened
                </div>
                <div className="cg-ai-badges">
                  <span className="cg-ai-model-badge">
                    <span className="cg-ai-live-dot" />
                    GPT-5.3
                  </span>
                  {isAuth && (
                    <button className="cg-refresh-btn"
                      onClick={() => generateAnalysis()}
                      disabled={aiLoading}>
                      {aiLoading ? '⏳' : '🔄'} Refresh
                    </button>
                  )}
                </div>
              </div>

              {isAuth && (
                <div className="cg-coin-strip">
                  <img src={coin.image} alt={coin.coinName}
                    onError={e => { e.target.src='https://via.placeholder.com/26'; }} />
                  <div>
                    <div className="cs-name">{coin.coinName}</div>
                    <div className="cs-symbol">{coin.symbol}</div>
                  </div>
                  <span className={`cs-change ${coin.change24h >= 0 ? 'pos' : 'neg'}`}>
                    {coin.change24h >= 0 ? '▲' : '▼'} {Math.abs(coin.change24h||0).toFixed(2)}% 24h
                  </span>
                </div>
              )}

              <div className="cg-ai-body">

                {!isAuth && (
                  <div className="cg-ai-lock">
                    <div className="cg-ai-lock-icon">🔒</div>
                    <h4>Sign in to view AI insights</h4>
                    <p>Log in to get real-time AI analysis powered by GPT-5.3</p>
                  </div>
                )}

                {isAuth && aiLoading && (
                  <div className="cg-ai-loading">
                    <div className="cg-ai-loading-bar">
                      <div className="cg-ai-spinner" />
                      <div className="cg-ai-loading-text">
                        <strong>Analysing {coin.coinName}...</strong>
                        <span>Searching latest news and market data</span>
                      </div>
                    </div>
                    {[100,85,92,60,78].map((w,i) => (
                      <div key={i} className="skeleton cg-skeleton-line"
                        style={{ width:`${w}%` }} />
                    ))}
                  </div>
                )}

                {isAuth && aiError && !aiLoading && (
                  <div className="cg-ai-error">
                    <div className="cg-ai-error-icon">⚠️</div>
                    <div className="cg-ai-error-text">
                      <strong>Analysis failed</strong>
                      <span>{aiError}</span>
                    </div>
                    <button className="cg-retry-btn"
                      onClick={() => generateAnalysis()}>
                      Retry
                    </button>
                  </div>
                )}

                {isAuth && aiData && !aiLoading && (
                  <div className="cg-ai-content">
                    {aiData.summary && (
                      <div className="cg-ai-section">
                        <div className="cg-ai-section-label">📊 Market Summary</div>
                        <p className="cg-ai-section-text">{aiData.summary}</p>
                      </div>
                    )}
                    {aiData.news && (
                      <div className="cg-ai-section">
                        <div className="cg-ai-section-label">📰 Recent News & Developments</div>
                        <p className="cg-ai-section-text">{aiData.news}</p>
                      </div>
                    )}
                    {aiData.sentiment && (
                      <div className="cg-ai-section">
                        <div className="cg-ai-section-label">🧭 Market Sentiment</div>
                        <div className="cg-sentiment-row">
                          <span className={`cg-sentiment-chip ${aiData.sentiment}`}>
                            {aiData.sentiment==='bullish'?'📈 Bullish'
                            :aiData.sentiment==='bearish'?'📉 Bearish'
                            :'➡️ Neutral'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {isAuth && aiData && !aiLoading && (
                <div className="cg-ai-footer">
                  <span>📌</span>
                  <span>
                    AI-generated analysis based on real-time market data and web search.
                    Not financial advice — always do your own research.
                  </span>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
