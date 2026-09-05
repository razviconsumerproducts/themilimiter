export type ProductionOrderStatus = 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type WorkOrderStatus = 'PENDING' | 'READY' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETE' | 'REWORK' | 'CANCELLED';

export interface ProductionQuantityInput { planned: number; completed: number; rejected: number; }
export interface ProductionQuantityResult { remaining: number; goodQuantity: number; isComplete: boolean; }

export function calculateProductionQuantity(input: ProductionQuantityInput): ProductionQuantityResult {
  for (const value of [input.planned, input.completed, input.rejected]) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Production quantities must be finite and non-negative');
  }
  if (input.planned <= 0) throw new Error('Planned production quantity must be greater than zero');
  if (input.completed + input.rejected > input.planned) throw new Error('Completed plus rejected quantity cannot exceed planned quantity');
  const goodQuantity = input.completed;
  const remaining = input.planned - input.completed - input.rejected;
  return { remaining, goodQuantity, isComplete: remaining === 0 };
}

export function validateMaterialIssue(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Material issue quantity must be greater than zero');
}
