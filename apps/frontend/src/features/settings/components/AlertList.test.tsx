// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { Alert } from '../../../types/system';
import { AlertList } from './AlertList';

// Test fixtures shaped like GET /api/alerts responses (alertJson + alerts.service.js data); not production data.
const base = { severity: 'info', trackedId: 3, attemptId: 41, readAt: null, emailStatus: 'not_configured', createdAt: new Date().toISOString() } as const;
const subject = { storeProductId: 2331, productName: 'Halvard Drawing Tablet Prime', optionId: 'o1', optionLabel: '64 GB', previousObservedAt: '2026-09-27T10:04:30.132Z' };
const alerts: Alert[] = [
  { ...base, id: 3, type: 'price_drop', severity: 'warning', title: 'Price drop', message: '…', data: { ...subject, currency: 'INR', previousPrice: 100000, currentPrice: 90000, change: -10000, changePct: -10 } },
  { ...base, id: 2, type: 'back_in_stock', title: 'Back in stock', message: '…', data: { ...subject, previousStock: 0, currentStock: 5 }, readAt: '2026-09-27T12:00:00.000Z' },
  { ...base, id: 1, type: 'structure_changed', severity: 'warning', trackedId: null, title: 'Store page structure changed', message: 'The price panel changed: price.', data: null },
];

afterEach(cleanup);

describe('AlertList', () => {
  it('labels each kind of alert and shows what changed', () => {
    renderWithProviders(<AlertList alerts={alerts} />);
    expect(screen.getByText('Price drop')).toBeTruthy();
    expect(screen.getByText('Back in stock')).toBeTruthy();
    expect(screen.getByText('Changed')).toBeTruthy();
    expect(screen.getByText('₹1,00,000 → ₹90,000 · −10.0%')).toBeTruthy();
    expect(screen.getByText('Out of stock → 5 available')).toBeTruthy();
    expect(screen.getByText('The price panel changed: price.')).toBeTruthy();
  });

  it('links an option alert to that option, and marks unread alerts', () => {
    renderWithProviders(<AlertList alerts={alerts} />);
    const links = screen.getAllByRole('link', { name: 'Halvard Drawing Tablet Prime · 64 GB' });
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/products/2331?option=o1', '/products/2331?option=o1']);
    expect(screen.getAllByLabelText('Unread')).toHaveLength(2);
  });
});
