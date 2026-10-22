/**
 * Trailing moving average over a sparse series. Each output is the mean of the
 * values within the previous `window` days (inclusive), ignoring gaps.
 */
export function trailingAverage<T extends { dayKey: string; value: number }>(
  points: T[],
  window = 7,
): (T & { avg: number })[] {
  const sorted = [...points].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  return sorted.map((p, i) => {
    const start = shiftDay(p.dayKey, -(window - 1));
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && sorted[j].dayKey >= start; j--) {
      sum += sorted[j].value;
      n++;
    }
    return { ...p, avg: Math.round((sum / n) * 100) / 100 };
  });
}

function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
