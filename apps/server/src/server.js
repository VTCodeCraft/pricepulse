import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { runProbe } from './debug/probe.js';

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) });
});

// PHASE 2 ONLY: Render feasibility probe. Removed together with src/debug/ once the gate is recorded.
// The route exists only when DEBUG_PROBE_SECRET is set, and runs one probe at a time (one browser in memory).
const probeSecret = process.env.DEBUG_PROBE_SECRET;
let probeRunning = false;
if (probeSecret) {
  app.get('/api/debug/probe', async (req, res) => {
    if (!sameSecret(req.get('x-debug-secret'), probeSecret)) return res.status(401).json({ error: 'unauthorized' });
    const id = Number(req.query.id);
    const opt = String(req.query.opt ?? '');
    if (!Number.isInteger(id) || id <= 0 || !/^o\d+$/.test(opt)) return res.status(400).json({ error: 'id must be a positive integer and opt like o1' });
    if (probeRunning) return res.status(409).json({ error: 'a probe is already running' });
    probeRunning = true;
    try {
      const result = await runProbe({ id, opt });
      res.status(result.ok ? 200 : 502).json(result);
    } finally {
      probeRunning = false;
    }
  });
}

function sameSecret(given = '', expected) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

app.listen(PORT, () => console.log(`server listening on :${PORT}`));
