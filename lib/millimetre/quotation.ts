import type { Currency } from './domain';

export interface QuotationItemInput {
  itemType: string;
  sourceType?: string;
  sourceId?: string;
  itemCode?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: Currency;
  discount?: Currency;
  taxRate?: number;
  notes?: string;
}

export interface QuotationInput {
  projectId: string;
  customerId: string;
  costingRunId: string;
  quotationCode: string;
  version: number;
  currency?: string;
  items: QuotationItemInput[];
  paymentTerms?: string;
  deliveryTerms?: string;
  installationTerms?: string;
  warrantyTerms?: string;
  notes?: string;
  customerNotes?: string;
  costSnapshot: unknown;
}

export interface QuotationResult {
  projectId: string;
  customerId: string;
  costingRunId: string;
  quotationCode: string;
  version: number;
  currency: string;
  items: Array<QuotationItemInput & { discount: Currency; taxRate: number; taxAmount: Currency; lineTotal: Currency }>;
  subtotal: Currency;
  discount: Currency;
  taxableAmount: Currency;
  taxAmount: Currency;
  grandTotal: Currency;
  commercialSnapshot: Record<string, unknown>;
}

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function buildQuotation(input: QuotationInput): QuotationResult {
  if (!input.projectId || !input.customerId || !input.costingRunId) throw new Error('Project, customer and costing run are required');
  if (input.version < 1 || !Number.isInteger(input.version)) throw new Error('Quotation version must be a positive integer');

  const items = input.items.map((item) => {
    const discount = item.discount ?? 0;
    const taxRate = item.taxRate ?? 0;
    if (item.quantity < 0 || item.unitPrice < 0 || discount < 0 || taxRate < 0) throw new Error(`Invalid quotation values for ${item.description}`);
    const gross = item.quantity * item.unitPrice;
    const lineTaxable = Math.max(0, gross - discount);
    const taxAmount = money(lineTaxable * taxRate / 100);
    return { ...item, discount: money(discount), taxRate, taxAmount, lineTotal: money(lineTaxable + taxAmount) };
  });

  const subtotal = money(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const discount = money(items.reduce((s, i) => s + i.discount, 0));
  const taxableAmount = money(subtotal - discount);
  const taxAmount = money(items.reduce((s, i) => s + i.taxAmount, 0));
  const grandTotal = money(taxableAmount + taxAmount);

  return {
    projectId: input.projectId,
    customerId: input.customerId,
    costingRunId: input.costingRunId,
    quotationCode: input.quotationCode,
    version: input.version,
    currency: input.currency ?? 'INR',
    items,
    subtotal,
    discount,
    taxableAmount,
    taxAmount,
    grandTotal,
    commercialSnapshot: {
      paymentTerms: input.paymentTerms ?? null,
      deliveryTerms: input.deliveryTerms ?? null,
      installationTerms: input.installationTerms ?? null,
      warrantyTerms: input.warrantyTerms ?? null,
      notes: input.notes ?? null,
      customerNotes: input.customerNotes ?? null,
    },
  };
}
