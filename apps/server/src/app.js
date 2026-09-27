// The Express app: CORS for the frontend, JSON bodies, the /api routes, and one error handler that turns every error
// into a JSON response. Express 5 passes errors thrown in async route handlers to that handler.
import express from 'express';
import { config } from './config.js';
import { cors } from './middleware/cors.js';
import { errorHandler, unknownRoute } from './middleware/error-handler.js';
import { alertsRoutes } from './routes/alerts.routes.js';
import { catalogRoutes } from './routes/catalog.routes.js';
import { exportRoutes } from './routes/export.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { layoutRoutes } from './routes/layout.routes.js';
import { runsRoutes } from './routes/runs.routes.js';
import { trackedRoutes } from './routes/tracked.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(config.corsOrigins));
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', healthRoutes, catalogRoutes, trackedRoutes, runsRoutes, alertsRoutes, layoutRoutes, exportRoutes);
  app.use(unknownRoute);
  app.use(errorHandler);
  return app;
}
