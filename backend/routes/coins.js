import { Router }    from 'express';
import { coinLimiter } from '../middleware/rateLimiter.js';
import {
  getCoins, getCoin, getGlobalStats,
  getTrending, getGainersLosers, getMarketChart,
} from '../controllers/coinController.js';
import { runSentimentForCoin } from '../services/sentimentService.js';
// ✅ Add this import at the top of backend/routes/coins.js
import { protect } from '../middleware/auth.js';
import { runTrustScoreForCoin } from '../services/trustScoreService.js';


const router = Router();

router.use(coinLimiter);

router.get('/',                 getCoins);
router.get('/global-stats',     getGlobalStats);
router.get('/trending',         getTrending);
router.get('/gainers-losers',   getGainersLosers);
router.get('/:id/market-chart', getMarketChart);
router.get('/:id',              getCoin);
// backend/routes/coins.js

// POST /api/coins/:id/refresh-sentiment
router.post('/:id/refresh-sentiment', protect, async (req, res) => {  try {
    const result = await runSentimentForCoin(req.params.id);
    res.json({ success: true, sentiment: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/refresh-trust', protect, async (req, res) => {
  const result = await runTrustScoreForCoin(req.params.id);
  res.json({ trustScore: result });
});

export default router;
