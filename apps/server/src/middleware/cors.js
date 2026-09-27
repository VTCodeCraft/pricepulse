// Only listed origins get CORS headers; the cron endpoints are called server-to-server and need none.
export function cors(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '600');
        return res.status(204).end();
      }
    }
    next();
  };
}
