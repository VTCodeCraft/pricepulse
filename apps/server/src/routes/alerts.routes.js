import { Router } from 'express';
import { listAlerts, markAlertRead, markAllAlertsRead } from '../db/repositories/alerts.repository.js';
import { notFound } from '../utils/http-error.js';
import { alertJson } from '../utils/serializers.js';
import { positiveInt, queryInt } from '../utils/validation.js';

export const alertsRoutes = Router();

alertsRoutes.get('/alerts', async (req, res) => {
  const limit = queryInt(req.query.limit, 'limit', { min: 1, max: 200, fallback: 50 });
  const rows = await listAlerts({ unreadOnly: req.query.unread === 'true', limit });
  res.json({ alerts: rows.map(alertJson) });
});

alertsRoutes.post('/alerts/read-all', async (_req, res) => {
  res.json({ updated: await markAllAlertsRead() });
});

alertsRoutes.post('/alerts/:id/read', async (req, res) => {
  const id = positiveInt(req.params.id, 'id');
  const alert = await markAlertRead(id);
  if (!alert) throw notFound('alert', id);
  res.json({ alert: alertJson(alert) });
});
