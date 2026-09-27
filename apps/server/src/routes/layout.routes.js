import { Router } from 'express';
import { listAlerts } from '../db/repositories/alerts.repository.js';
import { listLayoutVersions } from '../db/repositories/layout-versions.repository.js';
import { alertJson, layoutVersionJson } from '../utils/serializers.js';
import { queryInt } from '../utils/validation.js';

export const layoutRoutes = Router();

// Store layout versions seen by the scraper, newest first, plus structure-related alerts.
layoutRoutes.get('/layout', async (req, res) => {
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 100, fallback: 20 });
  const [versions, alerts] = await Promise.all([
    listLayoutVersions(limit),
    listAlerts({ unreadOnly: false, limit, types: ['structure_changed', 'store_app_updated'] }),
  ]);
  res.json({ versions: versions.map(layoutVersionJson), alerts: alerts.map(alertJson) });
});
