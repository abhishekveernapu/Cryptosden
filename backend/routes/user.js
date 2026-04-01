import { Router }  from 'express';
import { protect } from '../middleware/auth.js';
import { authApiLimiter } from '../middleware/rateLimiter.js';
import {
  getProfile, updateProfile,
  getWishlist, toggleWishlist,
} from '../controllers/userController.js';

const router = Router();

router.use(protect, authApiLimiter);

router.get  ('/',                 getProfile);
router.patch('/',                 updateProfile);
router.get  ('/wishlist',         getWishlist);
router.patch('/wishlist/:coinId', toggleWishlist);

export default router;
