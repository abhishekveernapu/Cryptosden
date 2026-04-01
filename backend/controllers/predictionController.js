import Prediction from '../models/Prediction.js';
import { trainGRU, trainAllGRU } from '../services/gruService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getPrediction = asyncHandler(async (req, res) => {
  const prediction = await Prediction.findOne({ coinId: req.params.coinId }).lean();
  if (!prediction) throw ApiError.notFound('No prediction yet — model may still be training');

  res.json({ success: true, prediction });
});

export const trainOne = asyncHandler(async (req, res) => {
  const { coinId } = req.params;
  trainGRU(coinId).catch(err =>
    console.error(`error Background GRU [${coinId}]:`, err.message)
  );
  res.json({ success: true, message: `🧠 GRU training started for ${coinId}` });
});

export const trainAll = asyncHandler(async (req, res) => {
  trainAllGRU().catch(err =>
    console.error('error Background trainAllGRU:', err.message)
  );
  res.json({ success: true, message: '🧠 GRU training started for all top 100 coins' });
});
