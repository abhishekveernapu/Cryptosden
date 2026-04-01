import { Link }       from 'react-router-dom';
import '../styles/landing.css';
import '../styles/global.css';

const FEATURES = [
  {
    icon:  '🧠',
    color: 'rgba(88,166,255,0.15)',
    title: 'GRU AI Price Predictions',
    desc:  'Deep learning model trained on 365 days of OHLCV + 13 technical indicators. Predicts 1d, 7d, 14d, 30d prices with 95% confidence bands.',
    tag:   'TensorFlow.js GRU',
  },
  {
    icon:  '🔐',
    color: 'rgba(163,113,247,0.15)',
    title: 'Trust Score Algorithm',
    desc:  'Composite 0–100 score from Fear & Greed, market health, CoinPaprika social, on-chain BTC data, and live ML signals.',
    tag:   '5-Source Composite',
  },
  {
    icon:  '😨',
    color: 'rgba(248,81,73,0.15)',
    title: 'Sentiment Analysis (eVI)',
    desc:  'Per-coin Extreme Value Index using Fear & Greed, CoinPaprika events, social buzz, and trending score. From Extreme Fear to Extreme Greed.',
    tag:   '4-Source Pipeline',
  },
  {
    icon:  '🐳',
    color: 'rgba(63,185,80,0.15)',
    title: 'Anomaly & Whale Alerts',
    desc:  'Z-score statistical detection + Isolation Forest ML + blockchain.info whale monitoring. Pop + email alerts for your watchlist coins.',
    tag:   '3-Method Detection',
  },
  {
    icon:  '🤖',
    color: 'rgba(210,153,34,0.15)',
    title: 'AI Crypto Assistant',
    desc:  'Powered by Gemini 2.0 Flash. Ask anything about market trends, coin analysis, or predictions. Floating chat on every page.',
    tag:   'Gemini 2.0 Flash',
  },
  {
    icon:  '📊',
    color: 'rgba(88,166,255,0.15)',
    title: 'Multi-Currency Charts',
    desc:  'Interactive Chart.js price & market cap charts from 24h to 1 year. Switch between USD, INR, EUR, GBP seamlessly.',
    tag:   'Chart.js · 4 Currencies',
  },
];

const STATS = [
  { label:'Cryptocurrencies', value:'1,000+', sub:'Top by market cap' },
  { label:'Data Sources',     value:'6',      sub:'Free APIs only' },
  { label:'Prediction Horizons', value:'4',   sub:'1d · 7d · 14d · 30d' },
  { label:'Alert Methods',    value:'3',      sub:'Z-Score · IF · Whale' },
];

export default function Landing() {
  return (
    <div style={{ animation:'fadeIn 0.4s ease' }}>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">

          <div className="hero-badge">
            ✨ AI-Powered Crypto Intelligence Platform
          </div>

          <h1 className="hero-title">
            Track, Analyse & Predict<br />
            <span>Crypto Markets</span> with AI
          </h1>

          <p className="hero-subtitle">
            CryptosDen combines real-time market data, deep learning predictions,
            trust scoring, and sentiment analysis to help you make smarter crypto decisions.
          </p>

          <div className="hero-cta">
            <Link to="/markets" className="btn btn-primary">
              🚀 Explore Markets
            </Link>
            <Link to="/register" className="btn btn-ghost">
              Create Free Account →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────── */}
      <div className="container" style={{ marginBottom:0 }}>
        <div className="stats-bar fade-in">
          {STATS.map(s => (
            <div key={s.label} className="stat-item">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="features-section">
        <div className="container">
          <div className="section-tag">⚡ Platform Features</div>
          <h2 className="section-title">
            Everything you need to<br />navigate crypto markets
          </h2>
          <p className="section-desc">
            Built with MERN stack + TensorFlow.js. All data from free APIs — no paid subscriptions required.
          </p>

          <div className="features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card fade-in">
                <div className="feature-icon" style={{ background: f.color }}>
                  {f.icon}
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <span className="feature-tag">{f.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────── */}
      <section style={{ padding:'60px 0' }}>
        <div className="container">
          <div style={{
            background:    'linear-gradient(135deg, rgba(88,166,255,0.1) 0%, rgba(163,113,247,0.1) 100%)',
            border:        '1px solid rgba(88,166,255,0.2)',
            borderRadius:  'var(--radius)',
            padding:       '48px 40px',
            textAlign:     'center',
          }}>
            <h2 style={{ fontSize:'28px', fontWeight:800, marginBottom:'12px', letterSpacing:'-0.5px' }}>
              Ready to make smarter crypto decisions?
            </h2>
            <p style={{ color:'var(--text-secondary)', marginBottom:'28px', fontSize:'15px' }}>
              Free to use. No credit card required.
            </p>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
              <Link to="/markets"  className="btn btn-primary" style={{ padding:'12px 28px', fontSize:'15px' }}>
                View Markets
              </Link>
              <Link to="/register" className="btn btn-ghost" style={{ padding:'12px 28px', fontSize:'15px' }}>
                Sign Up Free
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
