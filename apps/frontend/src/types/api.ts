// Every API error has this body (apps/server/src/middleware/error-handler.js).
export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};
