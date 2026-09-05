export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED' | 'SUPERSEDED';
export type PaymentStatus = 'PENDING' | 'RECEIVED' | 'VERIFIED' | 'FAILED' | 'REVERSED' | 'REFUNDED';

export interface CommercialGateInput {
  quotationStatus: string;
  approvalStatus: ApprovalStatus;
  requiredAdvance: number;
  verifiedAdvance: number;
  requiredApproval?: boolean;
}

export interface CommercialGateResult {
  status: 'NOT_READY' | 'READY';
  approvalSatisfied: boolean;
  advanceSatisfied: boolean;
  verifiedAdvance: number;
  reasons: string[];
}

export function evaluateCommercialGate(input: CommercialGateInput): CommercialGateResult {
  const approvalSatisfied = !input.requiredApproval || input.approvalStatus === 'APPROVED';
  const advanceSatisfied = input.verifiedAdvance >= Math.max(0, input.requiredAdvance);
  const reasons: string[] = [];
  if (!['ACCEPTED'].includes(input.quotationStatus)) reasons.push('Quotation must be accepted');
  if (!approvalSatisfied) reasons.push('Required approval is not satisfied');
  if (!advanceSatisfied) reasons.push('Required verified advance has not been received');
  return { status: reasons.length === 0 ? 'READY' : 'NOT_READY', approvalSatisfied, advanceSatisfied, verifiedAdvance: input.verifiedAdvance, reasons };
}
