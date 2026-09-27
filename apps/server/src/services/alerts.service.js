// Price-drop and back-in-stock alerts, raised by the runner after each attempt. Only validated observations
// (success / retried) are compared: a failed attempt has no price or stock, so it can neither raise an alert nor
// serve as the previous value.
import { insertAlert } from '../db/repositories/alerts.repository.js';

// Pure. `previous` and `current` are observations ({ outcome, price, currency, stock, finishedAt }); `tracked` is the
// tracked option with its product name. Returns the alerts the change from previous to current raises (0 to 2).
export function observationAlerts(previous, current, tracked) {
  if (!isObservation(previous) || !isObservation(current)) return [];
  const subject = {
    storeProductId: tracked.store_product_id,
    productName: tracked.product_name,
    optionId: tracked.option_id,
    optionLabel: tracked.option_label,
    previousObservedAt: previous.finishedAt,
  };
  const name = `${tracked.product_name} · ${tracked.option_label}`;
  const alerts = [];

  const before = Number(previous.price);
  const now = Number(current.price);
  // Prices in different currencies are not comparable.
  if (current.currency === previous.currency && now < before) {
    const change = round2(now - before);
    const changePct = round2((change / before) * 100);
    const thresholdPct = Number(tracked.price_drop_threshold_pct);
    alerts.push({
      type: 'price_drop',
      // Every drop is recorded; one at or past the option's threshold is flagged as a warning.
      severity: -changePct >= thresholdPct ? 'warning' : 'info',
      title: 'Price drop',
      message: `${name}: ${money(before, current.currency)} → ${money(now, current.currency)} (${changePct}%)`,
      data: { ...subject, currency: current.currency, previousPrice: before, currentPrice: now, change, changePct, thresholdPct },
    });
  }

  if (previous.stock === 0 && current.stock > 0) {
    alerts.push({
      type: 'back_in_stock',
      severity: 'info',
      title: 'Back in stock',
      message: `${name}: out of stock → ${current.stock} available`,
      data: { ...subject, previousState: 'out_of_stock', currentState: 'in_stock', previousStock: 0, currentStock: current.stock },
    });
  }
  return alerts;
}

// Stores the alerts for one finished attempt. The dedupe key is the attempt, so the same observation never alerts twice.
export async function recordObservationAlerts({ tracked, previous, current, attemptId }) {
  const created = [];
  for (const alert of observationAlerts(previous, current, tracked)) {
    const row = await insertAlert({ ...alert, trackedProductId: tracked.id, attemptId, dedupeKey: `attempt:${attemptId}` });
    if (row) created.push(row);
  }
  return created;
}

function isObservation(o) {
  return Boolean(o)
    && ['success', 'retried'].includes(o.outcome)
    && Number(o.price) > 0 && Number.isFinite(Number(o.price))
    && /^[A-Z]{3}$/.test(o.currency ?? '')
    && Number.isInteger(o.stock) && o.stock >= 0;
}

const round2 = value => Math.round(value * 100) / 100;
const money = (value, currency) => `${currency} ${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
