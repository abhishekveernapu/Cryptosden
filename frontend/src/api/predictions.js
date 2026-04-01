import api from "./axiosInstance";

export const getPrediction = (coinId) =>
  api.get(`/predictions/${coinId}`);
export const triggerTrain = (coinId) =>
  api.post(`/predictions/train/${coinId}`);
