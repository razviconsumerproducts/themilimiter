export type LabelType = 'PIECE' | 'BOX' | 'BUNDLE' | 'PRODUCT' | 'SHIPMENT';

export interface ProductionLabelInput {
  projectCode: string;
  productionCode: string;
  pieceCode?: string;
  type?: LabelType;
}

export interface ProductionLabelResult {
  labelCode: string;
  qrPayload: string;
}

function safePart(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed.replace(/[^A-Za-z0-9._-]/g, '-');
}

export function buildProductionLabel(input: ProductionLabelInput): ProductionLabelResult {
  const project = safePart(input.projectCode, 'Project code');
  const production = safePart(input.productionCode, 'Production code');
  const type = input.type ?? 'PIECE';
  const piece = input.pieceCode ? safePart(input.pieceCode, 'Piece code') : undefined;
  const labelCode = ['MM', project, production, type, piece].filter(Boolean).join('-');
  const payload = JSON.stringify({ v: 1, app: 'MILLIMETRE', label: labelCode, project, production, type, piece });
  return { labelCode, qrPayload: payload };
}

export function validateLabelPrintQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Label print quantity must be a positive integer');
  }
}
