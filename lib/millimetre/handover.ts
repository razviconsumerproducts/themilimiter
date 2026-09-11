export type HandoverStatus = 'DRAFT' | 'READY_FOR_ACCEPTANCE' | 'ACCEPTED' | 'PARTIAL' | 'REJECTED' | 'CANCELLED';
export type HandoverChecklistResult = 'PENDING' | 'PASS' | 'FAIL' | 'NA';

export interface HandoverChecklistInput {
  requiredItems: number;
  completedRequiredItems: number;
  failedRequiredItems: number;
  openSnags: number;
  blocked?: boolean;
}

export interface HandoverReadinessResult {
  status: 'READY_FOR_ACCEPTANCE' | 'BLOCKED' | 'NOT_READY';
  remainingChecklist: number;
  openSnags: number;
  canPresentToCustomer: boolean;
}

export function evaluateHandoverReadiness(input: HandoverChecklistInput): HandoverReadinessResult {
  const values = [input.requiredItems, input.completedRequiredItems, input.failedRequiredItems, input.openSnags];
  if (values.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error('Handover checklist quantities must be non-negative integers');
  }
  if (input.completedRequiredItems > input.requiredItems) {
    throw new Error('Completed required checklist items cannot exceed required items');
  }
  if (input.failedRequiredItems > input.completedRequiredItems) {
    throw new Error('Failed checklist items cannot exceed completed required items');
  }

  const remainingChecklist = input.requiredItems - input.completedRequiredItems;
  const blocked = Boolean(input.blocked) || input.failedRequiredItems > 0;
  const canPresentToCustomer = !blocked && remainingChecklist === 0;

  return {
    status: blocked ? 'BLOCKED' : canPresentToCustomer ? 'READY_FOR_ACCEPTANCE' : 'NOT_READY',
    remainingChecklist,
    openSnags: input.openSnags,
    canPresentToCustomer,
  };
}

export interface HandoverAcceptanceInput {
  readiness: HandoverReadinessResult;
  customerAccepted: boolean;
  acceptanceReference?: string;
}

export function finalizeHandover(input: HandoverAcceptanceInput): HandoverStatus {
  if (!input.readiness.canPresentToCustomer) {
    throw new Error('Handover cannot be accepted before the readiness gate is satisfied');
  }
  if (!input.customerAccepted) return 'REJECTED';
  if (!input.acceptanceReference?.trim()) {
    throw new Error('Customer acceptance reference is required');
  }
  return 'ACCEPTED';
}

export function buildHandoverCode(projectCode: string, sequence: number): string {
  const code = projectCode.trim().replace(/[^A-Za-z0-9._-]/g, '-');
  if (!code) throw new Error('Project code is required');
  if (!Number.isInteger(sequence) || sequence <= 0) throw new Error('Handover sequence must be a positive integer');
  return `HO-${code}-${String(sequence).padStart(3, '0')}`;
}
