import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { CurrencyProvider } from "./context/CurrencyContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import Layout from "./components/layout/Layout.jsx";
import Landing from "./pages/Landing.jsx";
import Home from "./pages/Home.jsx";
import CoinDetail from "./pages/CoinDetail.jsx";
import Watchlist from "./pages/Watchlist.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

const Protected = ({ children }) => {
  const { isAuth, loading } = useAuth();
  if (loading)
    return (
      <div
        style={{
          height: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px"
        }}
      >
        🦎
      </div>
    );
  return isAuth ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CurrencyProvider>
          <SocketProvider>
            <BrowserRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/markets" element={<Home />} />
                  <Route path="/coin/:id" element={<CoinDetail />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route
                    path="/watchlist"
                    element={
                      <Protected>
                        <Watchlist />
                      </Protected>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </BrowserRouter>
          </SocketProvider>
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
