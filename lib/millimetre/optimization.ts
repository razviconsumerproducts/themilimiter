import type { CuttingPart, Material } from './domain'

type Placement = {
  partIndex: number
  x: number
  y: number
  width: number
  height: number
  rotated: boolean
}

type Row = {
  y: number
  height: number
  nextX: number
}

type Sheet = {
  materialId: string
  materialCode: string
  width: number
  height: number
  usedWidth: number
  usedHeight: number
  placements: Placement[]
  rows: Row[]
}

function fits(value: number, limit: number) {
  return value <= limit + 1e-9
}

export function optimizeSheets(input: { parts: CuttingPart[]; materials: Material[]; kerfMm: number; trimAllowanceMm: number }) {
  const sheets: Sheet[] = []
  const unplaced: any[] = []
  let totalRequiredArea = 0
  let totalSheetArea = 0
  const kerf = Math.max(0, Number(input.kerfMm) || 0)
  const trim = Math.max(0, Number(input.trimAllowanceMm) || 0)

  for (let i = 0; i < input.parts.length; i++) {
    const p = input.parts[i]
    const m = input.materials.find(x => x.id === p.materialId)
    const qty = Math.max(0, Math.ceil(Number(p.qty) || 0))
    if (!qty) continue

    const sheetWidth = Number(m?.sheetWidth)
    const sheetHeight = Number(m?.sheetHeight)
    if (!m || !(sheetWidth > 0 && sheetHeight > 0)) {
      unplaced.push({ partIndex: i, reason: 'Material sheet size is missing' })
      continue
    }

    const length = Number(p.length)
    const width = Number(p.width)
    if (!(length > 0 && width > 0)) {
      unplaced.push({ partIndex: i, reason: 'Part dimensions must be positive' })
      continue
    }

    const usableWidth = sheetWidth - trim * 2
    const usableHeight = sheetHeight - trim * 2
    const grainRequired = Boolean(p.grain)
    const orientations = grainRequired
      ? [{ width: length, height: width, rotated: false }]
      : [
          { width: length, height: width, rotated: false },
          { width, height: length, rotated: true },
        ]

    totalRequiredArea += length * width * qty / 1_000_000

    for (let unit = 0; unit < qty; unit++) {
      let placed = false

      // First-fit into existing rows. A row has a fixed height, so placements
      // cannot overlap vertically or horizontally.
      for (const sheet of sheets.filter(s => s.materialId === m.id)) {
        for (const row of sheet.rows) {
          for (const o of orientations) {
            if (!fits(o.width, usableWidth - (row.nextX - trim))) continue
            if (!fits(o.height, row.height)) continue
            const x = row.nextX
            const y = row.y
            sheet.placements.push({ partIndex: i, x, y, width: o.width, height: o.height, rotated: o.rotated })
            row.nextX = x + o.width + kerf
            sheet.usedWidth = Math.max(sheet.usedWidth, row.nextX)
            sheet.usedHeight = Math.max(sheet.usedHeight, row.y + row.height)
            placed = true
            break
          }
          if (placed) break
        }
        if (placed) break
      }

      if (!placed) {
        for (const sheet of sheets.filter(s => s.materialId === m.id)) {
          const lastRow = sheet.rows[sheet.rows.length - 1]
          const nextY = lastRow ? lastRow.y + lastRow.height + kerf : trim
          for (const o of orientations) {
            if (!fits(o.width, usableWidth)) continue
            if (!fits(o.height, sheetHeight - trim - nextY)) continue
            const row: Row = { y: nextY, height: o.height, nextX: trim + o.width + kerf }
            sheet.rows.push(row)
            sheet.placements.push({ partIndex: i, x: trim, y: nextY, width: o.width, height: o.height, rotated: o.rotated })
            sheet.usedWidth = Math.max(sheet.usedWidth, row.nextX)
            sheet.usedHeight = Math.max(sheet.usedHeight, nextY + o.height)
            placed = true
            break
          }
          if (placed) break
        }
      }

      if (!placed) {
        let orientation = orientations.find(o => fits(o.width, usableWidth) && fits(o.height, usableHeight))
        if (!orientation) {
          unplaced.push({ partIndex: i, reason: grainRequired ? 'Part does not fit the usable sheet area without rotating grain' : 'Part is larger than the usable sheet area after trim allowance' })
          break
        }

        const row: Row = { y: trim, height: orientation.height, nextX: trim + orientation.width + kerf }
        sheets.push({
          materialId: m.id,
          materialCode: m.code,
          width: sheetWidth,
          height: sheetHeight,
          usedWidth: row.nextX,
          usedHeight: trim + orientation.height,
          placements: [{ partIndex: i, x: trim, y: trim, width: orientation.width, height: orientation.height, rotated: orientation.rotated }],
          rows: [row],
        })
        totalSheetArea += sheetWidth * sheetHeight / 1_000_000
      }
    }
  }

  const wasteArea = Math.max(0, totalSheetArea - totalRequiredArea)
  const utilizationPercentage = totalSheetArea ? totalRequiredArea / totalSheetArea * 100 : 0
  return {
    algorithm: 'MILLIMETRE_ROW_PACK_V3',
    kerfMm: kerf,
    trimAllowanceMm: trim,
    sheets: sheets.map(({ rows, ...sheet }) => sheet),
    unplaced,
    totalRequiredArea,
    totalSheetArea,
    wasteArea,
    utilizationPercentage,
  }
}
