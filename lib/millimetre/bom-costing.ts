import type { BomItemInput } from './bom';
import type { CostingItemInput } from './costing';

export interface BomPricedItem extends BomItemInput {
  unitCost: number;
  wastageQuantity?: number;
}

/**
 * Converts approved BOM requirements into costing inputs.
 * The BOM quantity is preserved exactly; wastage is an explicit costing concern.
 */
export function costingItemsFromBom(items: BomPricedItem[]): CostingItemInput[] {
  return items.map((item) => ({
    category: item.itemType === 'EDGE_BAND' ? 'EDGE_BAND' : item.itemType === 'HARDWARE' ? 'HARDWARE' : 'MATERIAL',
    sourceType: 'BOM_ITEM',
    sourceId: item.itemId,
    itemCode: item.itemCode,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitCost: item.unitCost,
    wastageQuantity: item.wastageQuantity ?? 0,
    calculationBasis: item.calculationBasis,
    notes: item.notes,
  }));
}
