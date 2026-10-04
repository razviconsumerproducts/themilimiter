export type ProductionQcStatus = 'PENDING' | 'PASS' | 'PARTIAL' | 'REWORK' | 'FAIL' | 'REJECTED';

export interface ProductionQcInput {
  inspected: number;
  accepted: number;
  rework: number;
  rejected: number;
}

export interface ProductionQcResult {
  status: Exclude<ProductionQcStatus, 'PENDING'>;
  accepted: number;
  rework: number;
  rejected: number;
  nonAccepted: number;
  isFullyAccepted: boolean;
}

function validateNonNegative(values: number[]): void {
  for (const value of values) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Production QC quantities must be finite and non-negative');
    }
  }
}

export function evaluateProductionQc(input: ProductionQcInput): ProductionQcResult {
  validateNonNegative([input.inspected, input.accepted, input.rework, input.rejected]);
  if (input.inspected <= 0) throw new Error('Inspected quantity must be greater than zero');
  if (input.accepted + input.rework + input.rejected !== input.inspected) {
    throw new Error('Accepted plus rework plus rejected quantity must equal inspected quantity');
  }

  const nonAccepted = input.rework + input.rejected;
  let status: Exclude<ProductionQcStatus, 'PENDING'>;
  if (input.accepted === input.inspected) status = 'PASS';
  else if (input.accepted > 0 && input.rework > 0 && input.rejected === 0) status = 'PARTIAL';
  else if (input.rework > 0) status = 'REWORK';
  else if (input.rejected === input.inspected) status = 'REJECTED';
  else status = 'FAIL';

  return {
    status,
    accepted: input.accepted,
    rework: input.rework,
    rejected: input.rejected,
    nonAccepted,
    isFullyAccepted: input.accepted === input.inspected,
  };
}

export interface ProductionReleaseGateInput {
  required: number;
  accepted: number;
  rework: number;
  rejected: number;
  blocked?: boolean;
}

export interface ProductionReleaseGateResult {
  status: 'READY' | 'BLOCKED' | 'NOT_READY';
  remaining: number;
  canRelease: boolean;
}

export function evaluateProductionReleaseGate(input: ProductionReleaseGateInput): ProductionReleaseGateResult {
  validateNonNegative([input.required, input.accepted, input.rework, input.rejected]);
  if (input.required <= 0) throw new Error('Required production quantity must be greater than zero');
  if (input.accepted > input.required) throw new Error('Accepted quantity cannot exceed required production quantity');

  const remaining = input.required - input.accepted;
  const canRelease = !input.blocked && remaining === 0;
  return {
    status: input.blocked ? 'BLOCKED' : canRelease ? 'READY' : 'NOT_READY',
    remaining,
    canRelease,
  };
}

export function validateAcceptedProductionQuantity(accepted: number, produced: number): void {
  validateNonNegative([accepted, produced]);
  if (accepted > produced) throw new Error('QC accepted quantity cannot exceed produced quantity');
}
