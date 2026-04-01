import { Router }    from 'express';
import { getPrediction, trainOne, trainAll } from '../controllers/predictionController.js';
import { protect }   from '../middleware/auth.js';
import { authApiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get ('/:coinId',       protect, authApiLimiter, getPrediction);
router.post('/train/:coinId', protect, trainOne);       
router.post('/train-all',     protect, trainAll);   

export default router;
