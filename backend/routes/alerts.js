import { Router }  from 'express';
import { getAlerts, getMyAlerts, resolveAlert, resolveAll } from '../controllers/alertController.js';
import { protect } from '../middleware/auth.js';
import { authApiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(protect, authApiLimiter);

router.get  ('/',          getAlerts);     // all alerts (admin view)
router.get  ('/my',        getMyAlerts);   // alerts for user's wishlist only
router.patch('/resolve-all', resolveAll);
router.patch('/:id',       resolveAlert);

export default router;
