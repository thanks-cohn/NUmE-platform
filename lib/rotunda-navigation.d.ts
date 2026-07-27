export type RotundaItem = { product_id: string };
export type RotundaMove<T extends RotundaItem> = { target: T | null; rowIndex: number; label: "Previous" | "Next" | "Ascend" | "Descend" };
export function resolveRotundaMove<T extends RotundaItem>(rows: T[][], selectedId: string | undefined, direction: -1 | 1): RotundaMove<T>;
