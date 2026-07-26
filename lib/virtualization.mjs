export const MAX_MOUNTED_ROWS = 15;
export const MAX_ACTIVE_TICKERS = 10;

export function virtualWindow(rowCount, scrollOffset, viewportHeight, rowHeight, buffer = 7) {
  if (rowCount <= 0 || rowHeight <= 0) return { start: 0, end: 0, top: 0, bottom: 0 };
  const firstVisible = Math.max(0, Math.floor(Math.max(0, scrollOffset) / rowHeight));
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  let start = Math.max(0, firstVisible - buffer);
  let end = Math.min(rowCount, firstVisible + visibleCount + buffer);
  if (end - start > MAX_MOUNTED_ROWS) {
    const overflow = end - start - MAX_MOUNTED_ROWS;
    const trimBefore = Math.min(Math.floor(overflow / 2), Math.max(0, firstVisible - start));
    start += trimBefore;
    end = start + MAX_MOUNTED_ROWS;
  }
  if (end - start > MAX_MOUNTED_ROWS) end = start + MAX_MOUNTED_ROWS;
  return { start, end, top: start * rowHeight, bottom: (rowCount - end) * rowHeight };
}

export function activeTickerIndexes(window, scrollOffset, viewportHeight, rowHeight, ceiling = MAX_ACTIVE_TICKERS) {
  const first = Math.max(window.start, Math.floor(Math.max(0, scrollOffset) / rowHeight) - 1);
  const last = Math.min(window.end, Math.ceil((Math.max(0, scrollOffset) + viewportHeight) / rowHeight) + 1);
  return Array.from({ length: Math.max(0, Math.min(ceiling, last - first)) }, (_, index) => first + index);
}

export function makeStressRows(rows, count) {
  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = index % rows.length;
    return { ...rows[sourceIndex], logicalKey: `${rows[sourceIndex].row_id}:logical:${index}`, sourceIndex };
  });
}

export const headingCompositions = ["upper-left", "upper-right", "inset-left", "upper-center", "vertical-edge", "image-overlay"];
export function headingComposition(index) { return headingCompositions[index % headingCompositions.length]; }
