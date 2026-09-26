import express from 'express';

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) });
});

app.listen(PORT, () => console.log(`server listening on :${PORT}`));
