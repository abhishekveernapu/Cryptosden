import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer
      style={{
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        padding: "40px 0 24px",
        marginTop: "auto"
      }}
    >
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "32px",
            marginBottom: "32px"
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px"
              }}
            >
              <span style={{ fontSize: "22px" }}>🦎</span>
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  background:
                    "linear-gradient(135deg, var(--accent), var(--purple))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent"
                }}
              >
                CryptosDen
              </span>
            </div>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                lineHeight: 1.7
              }}
            >
              Your intelligent crypto companion. Track, analyse, and make
              informed decisions.
            </p>
          </div>

          <div>
            <h4
              style={{
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "var(--text-muted)",
                marginBottom: "12px"
              }}
            >
              Markets
            </h4>
            {["All Cryptocurrencies", "Trending", "Top Gainers", "Watchlist"].map(
              (l) => (
                <div key={l} style={{ marginBottom: "8px" }}>
                  <Link
                    to="/markets"
                    style={{ fontSize: "13px", color: "var(--text-secondary)" }}
                  >
                    {l}
                  </Link>
                </div>
              )
            )}
          </div>

          <div>
            <h4
              style={{
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "var(--text-muted)",
                marginBottom: "12px"
              }}
            >
              Tools
            </h4>
            {[
              "AI Predictions",
              "Trust Score",
              "Sentiment Analysis",
              "Whale Alerts"
            ].map((l) => (
              <div key={l} style={{ marginBottom: "8px" }}>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)"
                  }}
                >
                  {l}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "12px",
            color: "var(--text-muted)"
          }}
        >
          <span>© 2026 CryptosDen. All rights reserved.</span>
          <span style={{ color: "var(--red)", fontSize: "11px" }}>
            ⚠️ Not financial advice. Always DYOR.
          </span>
        </div>
      </div>
    </footer>
  );
}
