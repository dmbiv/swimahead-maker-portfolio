export const INITIAL_TIME_ROW_COUNT = 40;
export const TIME_ROW_BATCH_SIZE = 40;

export function visibleTimeRows<T>(rows: T[], visibleCount: number): T[] {
  return rows.slice(0, Math.max(0, visibleCount));
}

export function nextVisibleTimeRowCount(current: number, total: number): number {
  return Math.min(current + TIME_ROW_BATCH_SIZE, total);
}
