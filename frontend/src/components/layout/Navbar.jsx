import { Link, NavLink } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCurrency } from "../../context/CurrencyContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import "../../styles/navbar.css";

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const { user, logout, isAuth } = useAuth();
  const { currency, changeCurrency } = useCurrency();
  const { unreadCount } = useSocket();

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo">
          <div className="navbar-logo-icon">🦎</div>
          <span className="navbar-logo-text">CryptosDen</span>
        </Link>

        <ul className="navbar-links hide-mobile">
          <li>
            <NavLink to="/markets">Markets</NavLink>
          </li>
          <li>
            <NavLink to="/watchlist">
              Watchlist {unreadCount ? `(${unreadCount})` : ""}
            </NavLink>
          </li>
        </ul>

        <div className="navbar-actions">
          <select
            value={currency}
            onChange={(e) => changeCurrency(e.target.value)}
            style={{
              background: "var(--bg-hover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xs)",
              color: "var(--text-primary)",
              padding: "6px 10px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              outline: "none"
            }}
          >
            <option value="usd">USD</option>
            <option value="inr">INR</option>
            <option value="eur">EUR</option>
            <option value="gbp">GBP</option>
          </select>

          <button
            className="theme-toggle"
            onClick={toggle}
            title="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {isAuth ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)"
                }}
              >
                👤 {user.username}
              </span>
              <button
                className="btn btn-ghost"
                onClick={logout}
                style={{ padding: "6px 12px", fontSize: "12px" }}
              >
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <Link
                to="/login"
                className="btn btn-ghost"
                style={{ padding: "6px 14px", fontSize: "13px" }}
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="btn btn-primary"
                style={{ padding: "6px 14px", fontSize: "13px" }}
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
