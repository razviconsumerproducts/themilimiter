import type { CuttingPart, Material } from './domain'

export function optimizeSheets(input: { parts: CuttingPart[]; materials: Material[]; kerfMm: number; trimAllowanceMm: number }) {
  const sheets: any[] = []
  const unplaced: any[] = []
  let totalRequiredArea = 0
  let totalSheetArea = 0

  for (let i = 0; i < input.parts.length; i++) {
    const p = input.parts[i]
    const m = input.materials.find(x => x.id === p.materialId)
    const qty = Math.max(0, Math.ceil(Number(p.qty) || 0))
    if (!qty) continue
    if (!m?.sheetWidth || !m.sheetHeight) {
      unplaced.push({ partIndex: i, reason: 'Material sheet size is missing' })
      continue
    }

    const length = Number(p.length)
    const width = Number(p.width)
    if (!(length > 0 && width > 0)) {
      unplaced.push({ partIndex: i, reason: 'Part dimensions must be positive' })
      continue
    }

    totalRequiredArea += length * width * qty / 1_000_000

    for (let unit = 0; unit < qty; unit++) {
      let placed = false
      for (const s of sheets.filter(x => x.materialId === m.id)) {
        const nextX = s.usedWidth + input.kerfMm + length
        if (nextX <= m.sheetWidth - input.trimAllowanceMm && s.usedHeight + width <= m.sheetHeight - input.trimAllowanceMm) {
          s.placements.push({ partIndex: i, x: s.usedWidth, y: s.usedHeight, width: length, height: width, rotated: false })
          s.usedWidth = nextX
          placed = true
          break
        }

        const nextY = s.usedHeight + input.kerfMm + width
        if (s.usedWidth + length <= m.sheetWidth - input.trimAllowanceMm && nextY <= m.sheetHeight - input.trimAllowanceMm) {
          s.placements.push({ partIndex: i, x: input.trimAllowanceMm, y: s.usedHeight, width: length, height: width, rotated: false })
          s.usedWidth = input.trimAllowanceMm + length
          s.usedHeight = nextY
          placed = true
          break
        }
      }

      if (!placed) {
        const usableWidth = m.sheetWidth - input.trimAllowanceMm * 2
        const usableHeight = m.sheetHeight - input.trimAllowanceMm * 2
        const fitsNormal = length <= usableWidth && width <= usableHeight
        const fitsRotated = width <= usableWidth && length <= usableHeight
        if (!fitsNormal && !fitsRotated) {
          unplaced.push({ partIndex: i, reason: 'Part is larger than the usable sheet area after trim allowance' })
          break
        }

        const rotated = !fitsNormal && fitsRotated
        const placedWidth = rotated ? width : length
        const placedHeight = rotated ? length : width
        sheets.push({
          materialId: m.id,
          materialCode: m.code,
          width: m.sheetWidth,
          height: m.sheetHeight,
          usedWidth: input.trimAllowanceMm + placedWidth,
          usedHeight: input.trimAllowanceMm + placedHeight,
          placements: [{ partIndex: i, x: input.trimAllowanceMm, y: input.trimAllowanceMm, width: placedWidth, height: placedHeight, rotated }],
        })
        totalSheetArea += m.sheetWidth * m.sheetHeight / 1_000_000
      }
    }
  }

  const wasteArea = Math.max(0, totalSheetArea - totalRequiredArea)
  const utilizationPercentage = totalSheetArea ? totalRequiredArea / totalSheetArea * 100 : 0
  return {
    algorithm: 'MILLIMETRE_ROW_PACK_V2',
    kerfMm: input.kerfMm,
    trimAllowanceMm: input.trimAllowanceMm,
    sheets,
    unplaced,
    totalRequiredArea,
    totalSheetArea,
    wasteArea,
    utilizationPercentage,
  }
}
