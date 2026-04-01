import User         from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProfile    = asyncHandler(async (req, res) => res.json({ success:true, user:req.user }));
export const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['theme','currency','emailAlerts'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new:true, runValidators:true });
  res.json({ success:true, user });
});
export const getWishlist = asyncHandler(async (req, res) =>
  res.json({ success:true, wishlist: req.user.wishlist })
);
export const toggleWishlist = asyncHandler(async (req, res) => {
  const { coinId } = req.params;
  const isIn       = req.user.wishlist.includes(coinId);

  if (!isIn && req.user.wishlist.length >= 5) {
    throw ApiError.badRequest('Wishlist limit reached (max 5 coins)');
  }

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    isIn ? { $pull: { wishlist: coinId } } : { $addToSet: { wishlist: coinId } },
    { new:true }
  );
  res.json({ success:true, wishlist: updated.wishlist, added: !isIn });
});
