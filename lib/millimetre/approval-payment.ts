export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED' | 'SUPERSEDED';
export type PaymentStatus = 'PENDING' | 'RECEIVED' | 'VERIFIED' | 'FAILED' | 'REVERSED' | 'REFUNDED';

export interface CommercialGateInput {
  quotationStatus: string;
  approvalStatus: ApprovalStatus;
  requiredAdvance: number;
  verifiedAdvance: number;
  requiredApproval?: boolean;
  quotationGrandTotal?: number;
  approvedAmount?: number;
}

export interface CommercialGateResult {
  status: 'NOT_READY' | 'READY';
  approvalSatisfied: boolean;
  advanceSatisfied: boolean;
  verifiedAdvance: number;
  reasons: string[];
}

export function evaluateCommercialGate(input: CommercialGateInput): CommercialGateResult {
  const reasons: string[] = [];
  const requiredApproval = input.requiredApproval ?? true;
  const requiredAdvance = input.requiredAdvance;
  const verifiedAdvance = input.verifiedAdvance;

  if (!Number.isFinite(requiredAdvance) || requiredAdvance < 0) {
    reasons.push('Required verified advance must be a finite non-negative amount');
  }

  if (!Number.isFinite(verifiedAdvance) || verifiedAdvance < 0) {
    reasons.push('Verified advance must be a finite non-negative amount');
  }

  if (input.quotationGrandTotal !== undefined &&
      (!Number.isFinite(input.quotationGrandTotal) || input.quotationGrandTotal < 0)) {
    reasons.push('Quotation grand total must be a finite non-negative amount');
  }

  if (input.approvedAmount !== undefined &&
      (!Number.isFinite(input.approvedAmount) || input.approvedAmount < 0)) {
    reasons.push('Approved amount must be a finite non-negative amount');
  }

  if (input.quotationGrandTotal !== undefined && input.approvedAmount !== undefined &&
      input.approvedAmount > input.quotationGrandTotal) {
    reasons.push('Approved amount cannot exceed quotation grand total');
  }

  const approvalAmountSatisfied =
    input.quotationGrandTotal === undefined || input.approvedAmount === undefined
      ? input.approvalStatus === 'APPROVED'
      : input.approvedAmount >= input.quotationGrandTotal;

  const approvalSatisfied = !requiredApproval ||
    (input.approvalStatus === 'APPROVED' && approvalAmountSatisfied);

  const advanceSatisfied = Number.isFinite(verifiedAdvance) &&
    verifiedAdvance >= Math.max(0, requiredAdvance);

  if (input.quotationStatus !== 'ACCEPTED') reasons.push('Quotation must be accepted');
  if (!approvalSatisfied) reasons.push('Required approval is not satisfied');
  if (!advanceSatisfied) reasons.push('Required verified advance has not been received');

  return {
    status: reasons.length === 0 ? 'READY' : 'NOT_READY',
    approvalSatisfied,
    advanceSatisfied,
    verifiedAdvance: Number.isFinite(verifiedAdvance) ? verifiedAdvance : 0,
    reasons,
  };
}
