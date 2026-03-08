import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { jwtAuth } from './middleware/auth.js';
import { stemRoutes } from './routes/stems.js';
import { importRoutes } from './routes/import.js';
import { healthRoutes } from './routes/health.js';
import { performanceRoutes } from './routes/performances.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.PUBLIC_APP_URL ?? 'http://localhost:5173',
  credentials: true,
}));

// Public routes
app.route('/health', healthRoutes);

// Protected routes
app.use('/api/*', jwtAuth);
app.route('/api/stems', stemRoutes);
app.route('/api/import', importRoutes);
app.route('/api/performances', performanceRoutes);

const port = parseInt(process.env.PORT ?? '3001', 10);
console.log(`Nuit One API running on port ${port}`);

serve({ fetch: app.fetch, port });
