import type { CalculationResult, CuttingList } from './domain';

/** Stable presentation/export order for workshop cutting lists. */
export function toCuttingList(projectId: string, result: CalculationResult, generatedAt = new Date().toISOString()): CuttingList {
  const parts = [...result.parts].sort((a, b) =>
    a.materialId.localeCompare(b.materialId) ||
    b.length * b.width - a.length * a.width ||
    a.name.localeCompare(b.name),
  );

  return { projectId, furnitureId: result.furnitureId, generatedAt, parts };
}

export function cuttingListCsv(list: CuttingList): string {
  const header = ['Part', 'Qty', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Material', 'Grain', 'Edge'];
  const rows = list.parts.map((p) => [
    p.name,
    p.qty,
    p.length,
    p.width,
    p.thickness,
    p.materialId,
    p.grain ? 'Y' : 'N',
    p.edge,
  ]);
  return [header, ...rows].map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
}
