export type VirtualWindow = { start: number; end: number; top: number; bottom: number };
export const MAX_MOUNTED_ROWS: 15;
export const MAX_ACTIVE_TICKERS: 10;
export function virtualWindow(rowCount: number, scrollOffset: number, viewportHeight: number, rowHeight: number, buffer?: number): VirtualWindow;
export function activeTickerIndexes(window: VirtualWindow, scrollOffset: number, viewportHeight: number, rowHeight: number, ceiling?: number): number[];
export function makeStressRows<T>(rows: T[], count: number): Array<T & { logicalKey: string; sourceIndex: number }>;
export const headingCompositions: string[];
export function headingComposition(index: number): string;
