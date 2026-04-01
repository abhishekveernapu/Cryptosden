import api from "./axiosInstance";

export const getProfile = () => api.get("/user");
export const updateProfile = (data) => api.patch("/user", data);
export const getWishlist = () => api.get("/user/wishlist");
export const toggleWishlist = (coinId) =>
  api.patch(`/user/wishlist/${coinId}`);
