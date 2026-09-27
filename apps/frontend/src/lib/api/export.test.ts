import { describe, expect, it } from 'vitest';
import { exportError, exportFilename } from './export';

describe('exportFilename', () => {
  const now = new Date('2026-09-27T10:38:45.267Z');

  it('uses the name the server gives when the header is readable', () => {
    const header = 'attachment; filename="pricepulse-scrape-history-2026-09-27T10-38-45-267Z.csv"';
    expect(exportFilename(header, now)).toBe('pricepulse-scrape-history-2026-09-27T10-38-45-267Z.csv');
  });

  it('falls back to the same pattern when the browser hides the header (cross-origin)', () => {
    expect(exportFilename(undefined, now)).toBe('pricepulse-scrape-history-2026-09-27T10-38-45-267Z.csv');
  });
});

describe('exportError', () => {
  it('reads the API error body from the blob', async () => {
    const body = new Blob([JSON.stringify({ error: { code: 'internal_error', message: 'Something went wrong on the server' } })]);
    await expect(exportError(500, body)).resolves.toMatchObject({ status: 500, code: 'internal_error', message: 'Something went wrong on the server' });
  });

  it('still explains a failure whose body is not the API’s (a gateway page)', async () => {
    const error = await exportError(502, new Blob(['<html>Bad gateway</html>']));
    expect(error).toMatchObject({ status: 502, code: 'export_failed', message: 'The export failed (HTTP 502)' });
  });
});
