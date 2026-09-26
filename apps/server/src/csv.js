// The CSV export required by the assignment: one row per scrape attempt, failed attempts included with empty
// price and stock. Timestamps are ISO 8601 in UTC.

export const CSV_COLUMNS = ['store_product_id', 'product_name', 'selected_option', 'timestamp', 'price', 'stock', 'outcome'];

// rows: { store_product_id, product_name, selected_option, finished_at: Date, price, stock, outcome }
export function attemptsToCsv(rows) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push([
      row.store_product_id,
      row.product_name,
      row.selected_option,
      row.finished_at.toISOString(),
      row.price, // null for a failed attempt (the database guarantees it) → empty cell
      row.stock,
      row.outcome,
    ].map(field).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

function field(value) {
  let text = value === null || value === undefined ? '' : String(value);
  // A leading = + - @ would make a spreadsheet treat the cell as a formula.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
