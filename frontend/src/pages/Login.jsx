import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login as loginApi } from "../api/auth";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/axiosInstance";

// Firebase imports
import { signInWithRedirect, getRedirectResult } from "firebase/auth";
import { auth, googleProvider, facebookProvider } from "../config/firebase";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle redirect result when page loads after Google/Facebook redirect
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        setLoading(true);
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          const providerName = user.providerData[0]?.providerId?.includes("google")
            ? "Google"
            : "Facebook";

          const response = await api.post("/auth/firebase-login", {
            email: user.email,
            displayName: user.displayName,
            uid: user.uid,
            provider: providerName,
          });

          if (response.data.success) {
            login(response.data.token, response.data.user);
            navigate("/markets");
          }
        }
      } catch (err) {
        console.error("Redirect result error:", err);
        if (err.code === "auth/account-exists-with-different-credential") {
          setError(
            "An account already exists with the same email but different sign-in credentials."
          );
        } else if (err.response?.data?.message) {
          setError(err.response.data.message);
        }
        // Silently ignore if no redirect happened (err.code === undefined)
      } finally {
        setLoading(false);
      }
    };

    handleRedirectResult();
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Email/Password Login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await loginApi(form);
      login(res.data.token, res.data.user);
      navigate("/markets");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Google / Facebook OAuth — uses redirect instead of popup (fixes COOP error on Render)
  const handleOAuthLogin = async (provider, providerName) => {
    try {
      setError("");
      setLoading(true);
      await signInWithRedirect(auth, provider);
      // Page redirects — code below does not run
    } catch (err) {
      console.error(`${providerName} login error:`, err);
      setError(`Failed to login with ${providerName}`);
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: "40px 0" }}>
      <div className="card" style={{ maxWidth: "420px", margin: "0 auto" }}>
        <h1 style={{ marginBottom: "16px", fontSize: "22px" }}>Log in</h1>

        {error && (
          <div
            style={{
              marginBottom: "12px",
              fontSize: "13px",
              color: "var(--red)",
            }}
          >
            {error}
          </div>
        )}

        {/* Email/Password Form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <div>
            <label style={{ fontSize: "13px" }}>Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                marginTop: "4px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: "13px" }}>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                marginTop: "4px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: "8px" }}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        {/* Divider */}
        <div
          style={{ display: "flex", alignItems: "center", margin: "20px 0" }}
        >
          <div
            style={{ flex: 1, height: "1px", background: "var(--border)" }}
          ></div>
          <span
            style={{
              padding: "0 10px",
              fontSize: "12px",
              color: "var(--text-secondary)",
            }}
          >
            OR
          </span>
          <div
            style={{ flex: 1, height: "1px", background: "var(--border)" }}
          ></div>
        </div>

        {/* OAuth Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Google */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuthLogin(googleProvider, "Google")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              transition: "background 0.2s",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.background = "var(--border)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "var(--bg-primary)")
            }
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Facebook */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuthLogin(facebookProvider, "Facebook")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid transparent",
              background: "#1877F2",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              transition: "background 0.2s",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.background = "#166FE5")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "#1877F2")
            }
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Continue with Facebook
          </button>
        </div>

        <p
          style={{
            marginTop: "16px",
            fontSize: "13px",
            color: "var(--text-secondary)",
            textAlign: "center",
          }}
        >
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            style={{ color: "var(--accent)", fontWeight: "500" }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
