export type PurchaseOrderStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED' | 'CLOSED';

export interface PurchaseOrderItemInput {
  itemCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate?: number;
  priceSnapshot?: Record<string, unknown>;
}

export interface PurchaseOrderResult {
  subtotal: number;
  tax: number;
  total: number;
  items: Array<PurchaseOrderItemInput & { lineTotal: number }>;
}

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calculatePurchaseOrder(items: PurchaseOrderItemInput[]): PurchaseOrderResult {
  if (!Array.isArray(items)) throw new Error('Purchase order items are required');
  const normalized = items.map((item) => {
    if (!item.itemCode || !item.description || !item.unit) throw new Error('Purchase item code, description and unit are required');
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error('Purchase quantity must be greater than zero');
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) throw new Error('Purchase unit price cannot be negative');
    const taxRate = item.taxRate ?? 0;
    if (!Number.isFinite(taxRate) || taxRate < 0) throw new Error('Purchase tax rate cannot be negative');
    return { ...item, taxRate, lineTotal: money(item.quantity * item.unitPrice * (1 + taxRate / 100)) };
  }).sort((a, b) => a.itemCode.localeCompare(b.itemCode) || a.description.localeCompare(b.description));
  const subtotal = money(normalized.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const tax = money(normalized.reduce((sum, item) => sum + item.quantity * item.unitPrice * ((item.taxRate ?? 0) / 100), 0));
  return { subtotal, tax, total: money(subtotal + tax), items: normalized };
}
