/** Returns a rotunda destination without coupling navigation to React state. */
export function resolveRotundaMove(rows, selectedId, direction) {
  const rowIndex = rows.findIndex((row) => row.some((item) => item.product_id === selectedId));
  const itemIndex = rows[rowIndex]?.findIndex((item) => item.product_id === selectedId) ?? -1;
  const backward = direction < 0;
  if (rowIndex < 0 || itemIndex < 0) return { target: null, rowIndex: -1, label: backward ? "Previous" : "Next" };

  if (backward && itemIndex > 0) return { target: rows[rowIndex][itemIndex - 1], rowIndex, label: "Previous" };
  if (backward && rowIndex > 0) return { target: rows[rowIndex - 1].at(-1) ?? null, rowIndex: rowIndex - 1, label: "Ascend" };
  if (!backward && itemIndex < rows[rowIndex].length - 1) return { target: rows[rowIndex][itemIndex + 1], rowIndex, label: "Next" };
  if (!backward && rowIndex < rows.length - 1) return { target: rows[rowIndex + 1][0] ?? null, rowIndex: rowIndex + 1, label: "Descend" };
  return { target: null, rowIndex, label: backward ? "Ascend" : "Descend" };
}
