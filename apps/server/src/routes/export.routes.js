import { Router } from 'express';
import { listAttemptsForExport } from '../db/repositories/scrape-attempts.repository.js';
import { attemptsToCsv } from '../utils/csv.js';

export const exportRoutes = Router();

exportRoutes.get('/export.csv', async (_req, res) => {
  const csv = attemptsToCsv(await listAttemptsForExport());
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="pricepulse-scrape-history-${stamp}.csv"`);
  res.send(csv);
});
