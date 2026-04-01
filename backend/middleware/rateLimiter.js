import rateLimit from 'express-rate-limit';

const make = (windowMs, max, message, keyFn) =>
  rateLimit({
    windowMs, max,
    message:         { success: false, message },
    standardHeaders: true,
    legacyHeaders:   false,
    keyGenerator:    keyFn ?? ((req) => req.user?.id?.toString() || req.ip),
    skip:            (req) => req.method === 'OPTIONS',
  });

export const authLimiter     = make(15*60*1000, 10,  'Too many auth attempts.',       (req) => req.ip);
export const chatLimiter     = make(60*1000,    15,  ' Chat limit reached.',        (req) => `chat:${req.user?.id}`);
export const analysisLimiter = make(60*1000,    30,  ' Analysis limit reached.',    (req) => `analysis:${req.user?.id || req.ip}`);
export const coinLimiter     = make(60*1000,    300, 'Too many coin requests.',        (req) => `coins:${req.ip}`);
export const authApiLimiter  = make(60*1000,    200, 'Too many requests.',             (req) => `api:${req.user?.id || req.ip}`);
export const globalLimiter   = make(15*60*1000, 2000,'Server busy. Try again later.', (req) => req.ip);
