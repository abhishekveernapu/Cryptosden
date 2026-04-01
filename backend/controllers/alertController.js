import Alert        from '../models/Alert.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getAlerts = asyncHandler(async (req, res) => {
  const {
    coinId,
    resolved = 'false',
    severity,
    type,
    limit = 50,
  } = req.query;

  const filter = { resolved: resolved === 'true' };
  if (coinId)   filter.coinId   = coinId;
  if (severity) filter.severity = severity;
  if (type)     filter.type     = type;

  const alerts = await Alert.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(200, parseInt(limit)))
    .lean();

  res.json({ success: true, count: alerts.length, alerts });
});

export const getMyAlerts = asyncHandler(async (req, res) => {
  // Return alerts only for the user's watchlist coins
  const wishlist = req.user.wishlist;
  if (!wishlist?.length) {
    return res.json({ success: true, count: 0, alerts: [] });
  }

  const alerts = await Alert.find({
    coinId:   { $in: wishlist },
    resolved: false,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ success: true, count: alerts.length, alerts });
});

export const resolveAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findByIdAndUpdate(
    req.params.id,
    { resolved: true },
    { new: true }
  );
  if (!alert) throw ApiError.notFound('Alert not found');
  res.json({ success: true, alert });
});

export const resolveAll = asyncHandler(async (req, res) => {
  const { coinId } = req.body;
  const filter = { resolved: false };
  if (coinId) filter.coinId = coinId;

  const result = await Alert.updateMany(filter, { resolved: true });
  res.json({ success: true, resolved: result.modifiedCount });
});
