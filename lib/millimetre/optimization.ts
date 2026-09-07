import type { CuttingPart, Material } from './domain';

export type OptimizationAlgorithm = 'FIRST_FIT';

export interface OptimizationInput {
  parts: CuttingPart[];
  materials: Material[];
  kerfMm?: number;
  trimAllowanceMm?: number;
  algorithm?: OptimizationAlgorithm;
}

export interface OptimizationPlacement {
  pieceInstanceId: string;
  partIndex: number;
  x: number;
  y: number;
  length: number;
  width: number;
  rotation: boolean;
}

export interface OptimizationSheet {
  sheetNumber: number;
  materialId: string;
  length: number;
  width: number;
  thickness: number;
  placements: OptimizationPlacement[];
  usedArea: number;
  wasteArea: number;
  utilizationPercentage: number;
}

export interface OptimizationResult {
  algorithm: OptimizationAlgorithm;
  kerfMm: number;
  trimAllowanceMm: number;
  sheets: OptimizationSheet[];
  unplaced: string[];
  totalRequiredArea: number;
  totalSheetArea: number;
  wasteArea: number;
  utilizationPercentage: number;
}

interface FreeRect { x: number; y: number; width: number; height: number }

function validPositive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be greater than zero`);
}

function tryPlace(free: FreeRect, length: number, width: number, kerf: number, trim: number) {
  const fits = (w: number, h: number) => w <= free.width && h <= free.height;
  if (fits(length + kerf, width + kerf)) return { length, width, rotation: false };
  if (fits(width + kerf, length + kerf)) return { length: width, width: length, rotation: true };
  return null;
}

export function optimizeSheets(input: OptimizationInput): OptimizationResult {
  const kerf = input.kerfMm ?? 3;
  const trim = input.trimAllowanceMm ?? 10;
  if (kerf < 0 || trim < 0) throw new Error('Kerf and trim allowance cannot be negative');

  const materials = new Map(input.materials.map((m) => [m.id, m]));
  const expanded = input.parts.flatMap((part, partIndex) => {
    if (!Number.isInteger(part.qty) || part.qty <= 0) throw new Error(`Invalid quantity for ${part.name}`);
    validPositive(part.length, `${part.name} length`);
    validPositive(part.width, `${part.name} width`);
    validPositive(part.thickness, `${part.name} thickness`);
    if (!materials.has(part.materialId)) throw new Error(`Missing material ${part.materialId}`);
    return Array.from({ length: part.qty }, (_, instance) => ({ part, partIndex, instance }));
  });

  expanded.sort((a, b) => b.part.length * b.part.width - a.part.length * a.part.width);
  const sheets: OptimizationSheet[] = [];
  const freeRects = new Map<number, FreeRect[]>();
  const unplaced: string[] = [];

  for (const item of expanded) {
    const material = materials.get(item.part.materialId)!;
    validPositive(material.sheetWidth ?? 0, `${material.code} sheet width`);
    validPositive(material.sheetHeight ?? 0, `${material.code} sheet length`);
    if (material.thickness !== item.part.thickness) {
      unplaced.push(`${item.part.name}-${item.instance + 1}`);
      continue;
    }

    let placed = false;
    const pieceId = `${item.part.id}-${item.instance + 1}`;
    for (let s = 0; s < sheets.length && !placed; s++) {
      const sheet = sheets[s];
      if (sheet.materialId !== item.part.materialId) continue;
      const rects = freeRects.get(s)!;
      for (let r = 0; r < rects.length; r++) {
        const fit = tryPlace(rects[r], item.part.length, item.part.width, kerf, trim);
        if (!fit) continue;
        const rect = rects.splice(r, 1)[0];
        sheet.placements.push({ pieceInstanceId: pieceId, partIndex: item.partIndex, x: rect.x, y: rect.y, length: fit.length, width: fit.width, rotation: fit.rotation });
        sheet.usedArea += item.part.length * item.part.width;
        rects.push({ x: rect.x + fit.length + kerf, y: rect.y, width: Math.max(0, rect.width - fit.length - kerf), height: fit.width + kerf });
        rects.push({ x: rect.x, y: rect.y + fit.width + kerf, width: rect.width, height: Math.max(0, rect.height - fit.width - kerf) });
        placed = true;
        break;
      }
    }

    if (!placed) {
      const length = material.sheetHeight!;
      const width = material.sheetWidth!;
      const usableLength = length - trim * 2;
      const usableWidth = width - trim * 2;
      const fit = tryPlace({ x: trim, y: trim, width: usableWidth, height: usableLength }, item.part.length, item.part.width, kerf, trim);
      if (!fit) {
        unplaced.push(pieceId);
        continue;
      }
      const sheetNumber = sheets.length + 1;
      const sheet: OptimizationSheet = { sheetNumber, materialId: item.part.materialId, length, width, thickness: material.thickness, placements: [], usedArea: 0, wasteArea: 0, utilizationPercentage: 0 };
      sheet.placements.push({ pieceInstanceId: pieceId, partIndex: item.partIndex, x: trim, y: trim, length: fit.length, width: fit.width, rotation: fit.rotation });
      sheet.usedArea = item.part.length * item.part.width;
      sheets.push(sheet);
      freeRects.set(sheets.length - 1, [
        { x: trim + fit.length + kerf, y: trim, width: Math.max(0, usableWidth - fit.length - kerf), height: fit.width },
        { x: trim, y: trim + fit.width + kerf, width: usableWidth, height: Math.max(0, usableLength - fit.width - kerf) },
      ]);
    }
  }

  let totalSheetArea = 0;
  let totalRequiredArea = 0;
  for (const sheet of sheets) {
    totalSheetArea += sheet.length * sheet.width;
    sheet.wasteArea = Math.max(0, sheet.length * sheet.width - sheet.usedArea);
    sheet.utilizationPercentage = sheet.length * sheet.width ? (sheet.usedArea / (sheet.length * sheet.width)) * 100 : 0;
  }
  for (const item of expanded) totalRequiredArea += item.part.length * item.part.width;
  const wasteArea = Math.max(0, totalSheetArea - totalRequiredArea);

  return {
    algorithm: input.algorithm ?? 'FIRST_FIT',
    kerfMm: kerf,
    trimAllowanceMm: trim,
    sheets,
    unplaced,
    totalRequiredArea,
    totalSheetArea,
    wasteArea,
    utilizationPercentage: totalSheetArea ? (totalRequiredArea / totalSheetArea) * 100 : 0,
  };
}
