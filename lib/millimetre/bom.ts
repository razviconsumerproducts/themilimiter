export type BomItemType = 'BOARD' | 'LAMINATE' | 'EDGE_BAND' | 'HARDWARE' | 'ACCESSORY' | 'CONSUMABLE' | 'OTHER';

export interface BomItemInput {
  furnitureItemId?: string;
  itemType: BomItemType;
  itemId?: string;
  itemCode?: string;
  description: string;
  quantity: number;
  unit: string;
  calculationBasis?: string;
  sourceComponentId?: string;
  notes?: string;
}

export interface BomInput {
  projectId: string;
  calculationRunId: string;
  version?: number;
  items: BomItemInput[];
}

export interface BomResult {
  projectId: string;
  calculationRunId: string;
  version: number;
  items: BomItemInput[];
  totalItems: number;
}

export function buildBom(input: BomInput): BomResult {
  if (!input.projectId || !input.calculationRunId) throw new Error('Project and calculation run are required');
  if ((input.version ?? 1) < 1 || !Number.isInteger(input.version ?? 1)) throw new Error('BOM version must be a positive integer');
  for (const item of input.items) {
    if (!item.description) throw new Error('BOM item description is required');
    if (item.quantity < 0) throw new Error(`Invalid BOM quantity for ${item.description}`);
    if (!item.unit) throw new Error(`BOM unit is required for ${item.description}`);
  }
  return {
    projectId: input.projectId,
    calculationRunId: input.calculationRunId,
    version: input.version ?? 1,
    items: [...input.items].sort((a, b) => a.itemType.localeCompare(b.itemType) || a.description.localeCompare(b.description)),
    totalItems: input.items.length,
  };
}
