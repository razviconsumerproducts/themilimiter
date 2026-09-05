export type ReceivingQcStatus = 'PENDING' | 'PASS' | 'PARTIAL' | 'FAIL' | 'HOLD';

export interface ReceiptQcInput {
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  holdQuantity: number;
}

export interface ReceiptQcResult extends ReceiptQcInput {
  inventoryEligibleQuantity: number;
  status: ReceivingQcStatus;
}

export function evaluateReceiptQc(input: ReceiptQcInput): ReceiptQcResult {
  const values = [input.receivedQuantity, input.acceptedQuantity, input.rejectedQuantity, input.holdQuantity];
  if (values.some((v) => !Number.isFinite(v) || v < 0)) throw new Error('Receipt quantities must be non-negative finite numbers');
  if (input.receivedQuantity <= 0) throw new Error('Received quantity must be greater than zero');
  if (input.acceptedQuantity + input.rejectedQuantity + input.holdQuantity !== input.receivedQuantity) {
    throw new Error('Accepted + rejected + hold quantity must equal received quantity');
  }
  let status: ReceivingQcStatus = 'PENDING';
  if (input.acceptedQuantity === input.receivedQuantity) status = 'PASS';
  else if (input.rejectedQuantity === input.receivedQuantity) status = 'FAIL';
  else if (input.holdQuantity === input.receivedQuantity) status = 'HOLD';
  else status = 'PARTIAL';
  return { ...input, inventoryEligibleQuantity: input.acceptedQuantity, status };
}
