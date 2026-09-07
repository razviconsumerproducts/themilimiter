export type InventoryTransactionType = 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'RETURN' | 'REJECT' | 'SCRAP';

export interface InventoryBalanceInput { physical: number; reserved: number; }
export interface InventoryBalance { physical: number; reserved: number; available: number; }

export function calculateInventoryBalance(input: InventoryBalanceInput): InventoryBalance {
  if (!Number.isFinite(input.physical) || !Number.isFinite(input.reserved)) throw new Error('Inventory quantities must be finite');
  if (input.physical < 0) throw new Error('Physical inventory cannot be negative');
  if (input.reserved < 0) throw new Error('Reserved inventory cannot be negative');
  const available = input.physical - input.reserved;
  return { physical: input.physical, reserved: input.reserved, available };
}

export function canIssueInventory(input: InventoryBalanceInput, quantity: number): boolean {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Issue quantity must be greater than zero');
  return calculateInventoryBalance(input).available >= quantity;
}
