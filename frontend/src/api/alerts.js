import api from "./axiosInstance";

export const getAlerts = (params) => api.get("/alerts", { params });
export const getMyAlerts = () => api.get("/alerts/my");
export const resolveAlert = (id) => api.patch(`/alerts/${id}`);
export const resolveAllAlerts = (coinId) =>
  api.patch("/alerts/resolve-all", { coinId });
