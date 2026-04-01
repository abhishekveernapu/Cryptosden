import { createContext, useContext, useState } from "react";

const CurrencyContext = createContext(null);
const SYMBOLS = { usd: "$", inr: "₹", eur: "€", gbp: "£" };

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState(
    localStorage.getItem("currency") || "usd"
  );

  const changeCurrency = (c) => {
    setCurrency(c);
    localStorage.setItem("currency", c);
  };

  const format = (value) => {
    if (value == null) return "—";
    const sym = SYMBOLS[currency] || "$";
    if (value >= 1e12) return `${sym}${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `${sym}${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${sym}${(value / 1e6).toFixed(2)}M`;
    if (value >= 1)
      return `${sym}${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    return `${sym}${value.toFixed(8)}`;
  };

  return (
    <CurrencyContext.Provider
      value={{ currency, changeCurrency, format, symbol: SYMBOLS[currency] }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
