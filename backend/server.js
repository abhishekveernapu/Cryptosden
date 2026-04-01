import 'dotenv/config';
import express          from 'express';
import cors             from 'cors';
import { createServer } from 'http';
import { Server }       from 'socket.io';

import { validateEnv }          from './config/env.js';
import connectDB                from './config/db.js';
import { errorHandler }         from './middleware/errorHandler.js';
import { globalLimiter }        from './middleware/rateLimiter.js';

import { setupSocket }                                        from './services/socketService.js';
import { updateTopCoins, updateDeepMarket, updateDeepFields } from './services/coinService.js';
import { fetchAllPriceHistory }                               from './services/priceHistoryService.js';
import { trainAllGRU }                                        from './services/gruService.js';
import { runAnomalyDetection }                                from './services/anomalyService.js';
import { runTrustScoreService }                               from './services/trustScoreService.js';
import { runSentimentService }                                from './services/sentimentService.js';
import { schedule }                                           from './utils/scheduler.js';

import authRoutes       from './routes/auth.js';
import coinRoutes       from './routes/coins.js';
import predictionRoutes from './routes/predictions.js';
import alertRoutes      from './routes/alerts.js';
import userRoutes       from './routes/user.js';

validateEnv();

const app    = express();
const server = createServer(app);
const PORT   = process.env.PORT         || 8080;
const ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';

// ✅ Step 1 — Add flag here (top-level, outside start())
let isGRUTraining = false;

app.use(cors({
  origin:         "https://cryptosden-frontend.onrender.com",
  credentials:    true,
  methods:        ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10kb' }));
app.use(globalLimiter);

const io = new Server(server, {
  cors: { origin: ORIGIN, credentials: true },
});
setupSocket(io);

app.use('/api/auth',        authRoutes);
app.use('/api/coins',       coinRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/alerts',      alertRoutes);
app.use('/api/user',        userRoutes);

app.get('/api/health', (_, res) =>
  res.json({
    success:   true,
    status:    'ok',
    uptime:    process.uptime(),
    timestamp: new Date(),
    gruTraining: isGRUTraining,
    services: {
      coingecko:   !!process.env.COINGECKO_API_KEY,
      coingecko2:  !!process.env.COINGECKO_API_KEY2,
      cryptoPanic: !!process.env.CRYPTOPANIC_API_KEY,
      email:       !!process.env.SMTP_USER,
    },
  })
);

app.use((req, res) =>
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  })
);

app.use(errorHandler);

const start = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`\n🦎 CryptosDen running → port ${PORT}\n`);
  });


   

  schedule('coins-top',         '*/5 * * * *',  () => !isGRUTraining && updateTopCoins());
  schedule('coins-deep',        '0 2 * * *',    () => updateDeepMarket());
  schedule('coins-deep-fields', '0 5 * * *',    () => updateDeepFields(500));
  schedule('anomaly',           '*/30 * * * *', () => !isGRUTraining && runAnomalyDetection(io));
  schedule('trust-score',       '0 * * * *',    () => !isGRUTraining && runTrustScoreService());
  schedule('sentiment',         '15 * * * *',   () => !isGRUTraining && runSentimentService());
  schedule('price-history',     '0 1 * * *',    () => fetchAllPriceHistory(100));

  schedule('gru-training', '0 3 * * *', async () => {
    isGRUTraining = true;
    console.log('🔒 GRU Training started — heavy services paused');
    try {
      await trainAllGRU(100);
    } finally {
      isGRUTraining = false;
      console.log('🔓 GRU Training complete — all services resumed');
    }
  });
};

start().catch(err => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});