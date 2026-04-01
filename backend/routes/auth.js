// In auth.js (or auth-23.js)
import { Router } from 'express';
import { register, login, getMe, firebaseLogin } from '../controllers/authController.js'; // Added firebaseLogin
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/firebase-login', authLimiter, firebaseLogin); // New route
router.get('/me', protect, getMe);

export default router;
