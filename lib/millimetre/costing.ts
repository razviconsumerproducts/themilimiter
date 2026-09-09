import type { Currency } from './domain';

export type CostCategory = 'MATERIAL' | 'HARDWARE' | 'EDGE_BAND' | 'LABOUR' | 'SERVICE' | 'TRANSPORT' | 'INSTALLATION' | 'OVERHEAD' | 'OTHER';

export interface CostingItemInput {
  category: CostCategory;
  sourceType?: string;
  sourceId?: string;
  itemCode?: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: Currency;
  wastageQuantity?: number;
  calculationBasis?: string;
  notes?: string;
}

export interface CostingItem extends CostingItemInput {
  wastageQuantity: number;
  wastageCost: Currency;
  totalCost: Currency;
}

export interface CostingInput {
  projectId: string;
  currency?: string;
  items: CostingItemInput[];
  discount?: Currency;
  taxRate?: number;
  marginType?: 'MARKUP_PERCENT' | 'GROSS_MARGIN_PERCENT' | 'FIXED_MARGIN' | 'FIXED_SELLING_PRICE';
  marginValue?: Currency;
}

export interface CostingResult {
  projectId: string;
  currency: string;
  items: CostingItem[];
  subtotal: Currency;
  discount: Currency;
  taxableAmount: Currency;
  tax: Currency;
  totalCost: Currency;
  sellingPrice: Currency;
  margin: Currency;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateCosting(input: CostingInput): CostingResult {
  if (!input.projectId) throw new Error('Project is required');
  if (input.discount !== undefined && input.discount < 0) throw new Error('Discount cannot be negative');
  if (input.taxRate !== undefined && input.taxRate < 0) throw new Error('Tax rate cannot be negative');

  const items = input.items.map((item) => {
    if (item.quantity < 0 || item.unitCost < 0 || (item.wastageQuantity ?? 0) < 0) {
      throw new Error(`Invalid costing quantity/rate for ${item.description}`);
    }
    const wastageQuantity = item.wastageQuantity ?? 0;
    return {
      ...item,
      wastageQuantity,
      wastageCost: money(wastageQuantity * item.unitCost),
      totalCost: money((item.quantity + wastageQuantity) * item.unitCost),
    };
  });

  const subtotal = money(items.reduce((sum, item) => sum + item.totalCost, 0));
  const discount = money(Math.min(input.discount ?? 0, subtotal));
  const taxableAmount = money(subtotal - discount);
  const tax = money(taxableAmount * ((input.taxRate ?? 0) / 100));
  const totalCost = money(taxableAmount + tax);
  const marginValue = input.marginValue ?? 0;
  let sellingPrice = totalCost;
  if (input.marginType === 'MARKUP_PERCENT') sellingPrice = money(totalCost * (1 + marginValue / 100));
  else if (input.marginType === 'GROSS_MARGIN_PERCENT') {
    if (marginValue >= 100) throw new Error('Gross margin must be below 100%');
    sellingPrice = money(totalCost / (1 - marginValue / 100));
  } else if (input.marginType === 'FIXED_MARGIN') sellingPrice = money(totalCost + marginValue);
  else if (input.marginType === 'FIXED_SELLING_PRICE') sellingPrice = money(marginValue);

  return {
    projectId: input.projectId,
    currency: input.currency ?? 'INR',
    items,
    subtotal,
    discount,
    taxableAmount,
    tax,
    totalCost,
    sellingPrice,
    margin: money(sellingPrice - totalCost),
  };
}
