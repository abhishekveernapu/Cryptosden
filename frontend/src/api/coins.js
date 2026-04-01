import api from "./axiosInstance";

export const fetchCoins = (params) => api.get("/coins", { params });
export const fetchCoin = (id) => api.get(`/coins/${id}`);
export const fetchGlobalStats = () => api.get("/coins/global-stats");
export const fetchTrending = () => api.get("/coins/trending");
export const fetchGainersLosers = () => api.get("/coins/gainers-losers");
export const fetchMarketChart = (id, days, currency = 'usd') =>
  api.get(`/coins/${id}/market-chart`, { params: { days, currency } });