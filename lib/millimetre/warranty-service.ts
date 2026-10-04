export type WarrantyStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type ServiceRequestStatus = 'NEW' | 'TRIAGED' | 'SCHEDULED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type WarrantyEligibility = 'ELIGIBLE' | 'INELIGIBLE' | 'REQUIRES_REVIEW';

export interface WarrantyActivationInput {
  handoverAccepted: boolean;
  startDate: string;
  durationValue: number;
  durationUnit: 'DAYS' | 'MONTHS' | 'YEARS';
  endDate: string;
}

export interface WarrantyActivationResult {
  valid: boolean;
  errors: string[];
}

export function validateWarrantyActivation(input: WarrantyActivationInput): WarrantyActivationResult {
  const errors: string[] = [];
  if (!input.handoverAccepted) errors.push('Warranty cannot activate before accepted handover.');
  if (!input.startDate || !input.endDate) errors.push('Warranty start and end dates are required.');
  if (!Number.isFinite(input.durationValue) || input.durationValue <= 0) errors.push('Warranty duration must be greater than zero.');
  if (input.startDate && input.endDate && input.endDate < input.startDate) errors.push('Warranty end date cannot precede start date.');
  return { valid: errors.length === 0, errors };
}

export interface WarrantyEligibilityInput {
  warrantyStatus: WarrantyStatus;
  coverageStart: string;
  coverageEnd: string;
  requestDate: string;
  coverageType?: string | null;
}

export interface WarrantyEligibilityResult {
  eligibility: WarrantyEligibility;
  reason: string;
}

export function evaluateWarrantyEligibility(input: WarrantyEligibilityInput): WarrantyEligibilityResult {
  if (input.warrantyStatus !== 'ACTIVE') return { eligibility: 'INELIGIBLE', reason: 'Warranty is not active.' };
  if (!input.coverageStart || !input.coverageEnd || !input.requestDate) return { eligibility: 'REQUIRES_REVIEW', reason: 'Warranty coverage dates are incomplete.' };
  if (input.requestDate < input.coverageStart || input.requestDate > input.coverageEnd) return { eligibility: 'INELIGIBLE', reason: 'Service request is outside the warranty coverage period.' };
  return { eligibility: 'ELIGIBLE', reason: 'Service request falls within active warranty coverage.' };
}

export interface ServiceCompletionInput {
  status: ServiceRequestStatus;
  qcPassed: boolean;
  customerConfirmed: boolean;
  openIssues: number;
}

export interface ServiceCompletionResult {
  canClose: boolean;
  errors: string[];
}

export function evaluateServiceCompletion(input: ServiceCompletionInput): ServiceCompletionResult {
  const errors: string[] = [];
  if (!input.qcPassed) errors.push('Service QC must pass before closure.');
  if (!input.customerConfirmed) errors.push('Customer confirmation is required before service closure.');
  if (!Number.isFinite(input.openIssues) || input.openIssues < 0) errors.push('Open issue count is invalid.');
  else if (input.openIssues > 0) errors.push('Open service issues must be resolved before closure.');
  return { canClose: errors.length === 0, errors };
}

export interface ServiceCostInput { quantity: number; unitCost: number; }
export interface ServiceCostResult { totalCost: number; }

export function calculateServiceCost(input: ServiceCostInput): ServiceCostResult {
  if (!Number.isFinite(input.quantity) || input.quantity < 0) throw new Error('Service quantity must be non-negative.');
  if (!Number.isFinite(input.unitCost) || input.unitCost < 0) throw new Error('Service unit cost must be non-negative.');
  return { totalCost: Math.round(input.quantity * input.unitCost * 100) / 100 };
}
