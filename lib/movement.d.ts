export type RowMovement = { speed: number; direction: -1 | 1 };
export function movementForRow(rowIndex: number, reducedMotion?: boolean): RowMovement;
export function movementConfiguration(rowCount: number, reducedMotion?: boolean): RowMovement[];
export function wrapTickerPosition(position: number, target: number, cycleWidth: number): { position: number; target: number };
