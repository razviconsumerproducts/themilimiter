import type { CalculationInput, CalculationResult, Component, CuttingPart, Material } from './domain';

const positive = (value: number, fallback = 0) => (Number.isFinite(value) && value > 0 ? value : fallback);
const area = (length: number, width: number, qty: number) => (length * width * qty) / 1_000_000;
const edgeLength = (length: number, width: number, qty: number, edge: Component['edge']) => {
  const sides = edge === 'all' ? 2 * (length + width) : edge === 'front' || edge === 'back' ? length : edge === 'left' || edge === 'right' ? width : 0;
  return (sides * qty) / 1000;
};

function part(
  furnitureId: string,
  material: Material,
  kind: Component['kind'],
  name: string,
  qty: number,
  length: number,
  width: number,
  edge: Component['edge'] = 'none',
  grain = false,
): CuttingPart {
  const safeQty = Math.max(0, Math.floor(qty));
  const safeLength = positive(length);
  const safeWidth = positive(width);
  return {
    id: `${furnitureId}-${kind}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    furnitureId,
    kind,
    name,
    qty: safeQty,
    length: safeLength,
    width: safeWidth,
    thickness: material.thickness,
    materialId: material.id,
    grain,
    edge,
    areaSqM: area(safeLength, safeWidth, safeQty),
    edgeLengthM: edgeLength(safeLength, safeWidth, safeQty, edge),
  };
}

export function calculateFurniture(input: CalculationInput): CalculationResult {
  const { furniture: f, carcassMaterial: carcass, backMaterial: back, shutterMaterial: shutter } = input;
  const t = f.carcassThickness;
  const innerWidth = Math.max(0, f.width - 2 * t);
  const innerHeight = Math.max(0, f.height - 2 * t);
  const parts: CuttingPart[] = [];

  parts.push(part(f.id, carcass, 'panel', 'Left side', 1, f.height, f.depth, 'front'));
  parts.push(part(f.id, carcass, 'panel', 'Right side', 1, f.height, f.depth, 'front'));
  parts.push(part(f.id, carcass, 'panel', 'Top', 1, innerWidth, f.depth, 'front'));
  parts.push(part(f.id, carcass, 'panel', 'Bottom', 1, innerWidth, f.depth, 'front'));

  if (input.includeShelves) {
    const shelves = Math.max(0, Math.floor(f.shelfCount ?? 0));
    if (shelves) parts.push(part(f.id, carcass, 'shelf', 'Adjustable shelf', shelves, innerWidth, Math.max(0, f.depth - 20), 'front'));
  }

  if (input.includeDrawers) {
    const drawers = Math.max(0, Math.floor(f.drawerCount ?? 0));
    if (drawers) {
      const drawerHeight = Math.max(0, Math.floor((innerHeight - Math.max(0, drawers - 1) * 2) / Math.max(1, drawers)));
      parts.push(part(f.id, carcass, 'drawer_box', 'Drawer box front/back', drawers * 2, innerWidth - 40, drawerHeight, 'front'));
      parts.push(part(f.id, carcass, 'drawer_box', 'Drawer box sides', drawers * 2, f.depth - 40, drawerHeight, 'front'));
    }
  }

  if (input.includeBack && back) {
    parts.push(part(f.id, back, 'back', 'Back', 1, f.height, f.width, 'none'));
  }

  if (input.includeShutters && shutter) {
    const gap = Math.max(0, f.shutterGap);
    const shutterWidth = Math.max(0, f.width - gap * 2);
    parts.push(part(f.id, shutter, 'shutter', 'Shutter', 1, Math.max(0, f.height - gap * 2), shutterWidth, 'all', true));
  }

  const materialAreaSqM: Record<string, number> = {};
  for (const p of parts) materialAreaSqM[p.materialId] = (materialAreaSqM[p.materialId] ?? 0) + p.areaSqM;

  return {
    furnitureId: f.id,
    parts,
    totalAreaSqM: parts.reduce((sum, p) => sum + p.areaSqM, 0),
    totalEdgeLengthM: parts.reduce((sum, p) => sum + p.edgeLengthM, 0),
    materialAreaSqM,
  };
}
