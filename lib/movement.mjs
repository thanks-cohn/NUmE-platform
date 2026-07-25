const BASE_SPEED = 0.3;
const SPEED_VARIATIONS = [0.12, 0.02, 0.07, -0.01, 0.05];

export function movementForRow(rowIndex, reducedMotion = false) {
  const variation = SPEED_VARIATIONS[rowIndex % SPEED_VARIATIONS.length] +
    Math.floor(rowIndex / SPEED_VARIATIONS.length) * 0.006;
  const magnitude = reducedMotion ? 0 : Math.max(0.08, BASE_SPEED + variation);
  return { speed: magnitude, direction: rowIndex % 2 === 0 ? -1 : 1 };
}

export function movementConfiguration(rowCount, reducedMotion = false) {
  return Array.from({ length: rowCount }, (_, index) => movementForRow(index, reducedMotion));
}

export function wrapTickerPosition(position, target, cycleWidth) {
  if (!Number.isFinite(cycleWidth) || cycleWidth <= 0) return { position, target };
  while (position <= -cycleWidth * 3) { position += cycleWidth; target += cycleWidth; }
  while (position >= -cycleWidth) { position -= cycleWidth; target -= cycleWidth; }
  return { position, target };
}
