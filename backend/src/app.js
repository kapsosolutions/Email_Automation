import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import env from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/index.js';
import apiRoutes from './routes/index.js';
import trackingRoutes from './routes/tracking.routes.js';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: same-origin, curl, or a mail client fetching the pixel.
      if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// Tracking lives outside /api: these URLs are embedded in sent mail and are
// hit by mail clients, so they stay short and stable.
app.use('/t', trackingRoutes);

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({ name: env.appName, api: '/api', health: '/api/system/health' });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
