// Request validation. Each function returns the valid value or throws a 400 HttpError.
import { SCRAPE_INTERVALS } from '../scheduler/schedule.js';
import { HttpError } from './http-error.js';

export function objectBody(body, allowedKeys) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'invalid_request', 'Body must be a JSON object');
  const unknown = Object.keys(body).filter(key => !allowedKeys.includes(key));
  if (unknown.length) throw new HttpError(400, 'invalid_request', `Unknown field(s): ${unknown.join(', ')}`);
  return body;
}

// Accepts a JSON number or a digits-only string (path parameters are strings).
export function positiveInt(value, name) {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number <= 0) throw new HttpError(400, 'invalid_request', `${name} must be a positive integer`);
  return number;
}

export function queryInt(value, name, { min, max, fallback }) {
  if (value === undefined) return fallback;
  const number = /^\d+$/.test(String(value)) ? Number(value) : NaN;
  if (!(number >= min && number <= max)) throw new HttpError(400, 'invalid_request', `${name} must be an integer from ${min} to ${max}`);
  return number;
}

// One or more distinct option ids, e.g. ["o1", "o3"].
export function optionIdsValue(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new HttpError(400, 'invalid_request', 'optionIds must be a list of 1 to 20 option ids');
  }
  const ids = value.map(id => optionIdValue(id));
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'invalid_request', 'optionIds must not repeat an option');
  return ids;
}

export function optionIdValue(value) {
  if (typeof value !== 'string' || !/^o\d{1,2}$/.test(value)) throw new HttpError(400, 'invalid_request', 'optionId must look like "o1"');
  return value;
}

export function intervalValue(value) {
  if (!SCRAPE_INTERVALS.includes(value)) {
    throw new HttpError(400, 'invalid_request', `scrapeIntervalMinutes must be one of ${SCRAPE_INTERVALS.join(', ')}`);
  }
  return value;
}

export function thresholdValue(value) {
  if (typeof value !== 'number' || !(value >= 0.5 && value <= 90)) {
    throw new HttpError(400, 'invalid_request', 'priceDropThresholdPct must be a number from 0.5 to 90');
  }
  return value;
}
