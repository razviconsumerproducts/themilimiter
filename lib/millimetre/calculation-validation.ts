import type { CalculationInput } from './domain';

export type CalculationIssueCode =
  | 'INVALID_DIMENSION'
  | 'INVALID_THICKNESS'
  | 'MISSING_MATERIAL'
  | 'MISSING_SHEET_SIZE'
  | 'INVALID_QUANTITY';

export interface CalculationIssue {
  code: CalculationIssueCode;
  field: string;
  message: string;
}

export interface CalculationValidation {
  errors: CalculationIssue[];
  warnings: CalculationIssue[];
  valid: boolean;
}

const positive = (value: number | undefined) => Number.isFinite(value) && (value ?? 0) > 0;

export function validateCalculationInput(input: CalculationInput): CalculationValidation {
  const errors: CalculationIssue[] = [];
  const warnings: CalculationIssue[] = [];
  const f = input.furniture;

  for (const [field, value] of [
    ['width', f.width],
    ['height', f.height],
    ['depth', f.depth],
    ['carcassThickness', f.carcassThickness],
  ] as const) {
    if (!positive(value)) errors.push({ code: 'INVALID_DIMENSION', field, message: `${field} must be greater than zero.` });
  }

  if (!positive(input.carcassMaterial.thickness)) {
    errors.push({ code: 'INVALID_THICKNESS', field: 'carcassMaterial.thickness', message: 'Carcass material thickness must be greater than zero.' });
  }
  if (!input.carcassMaterial.id) {
    errors.push({ code: 'MISSING_MATERIAL', field: 'carcassMaterial', message: 'A carcass material is required.' });
  }

  if (input.includeBack) {
    if (!input.backMaterial?.id) errors.push({ code: 'MISSING_MATERIAL', field: 'backMaterial', message: 'Back material is required when back is enabled.' });
    else if (!positive(input.backMaterial.thickness)) errors.push({ code: 'INVALID_THICKNESS', field: 'backMaterial.thickness', message: 'Back material thickness must be greater than zero.' });
  }

  if (input.includeShutters) {
    if (!input.shutterMaterial?.id) errors.push({ code: 'MISSING_MATERIAL', field: 'shutterMaterial', message: 'Shutter material is required when shutters are enabled.' });
    if (f.shutterGap < 0) errors.push({ code: 'INVALID_DIMENSION', field: 'shutterGap', message: 'Shutter gap cannot be negative.' });
  }

  for (const [field, value] of [['shelfCount', f.shelfCount], ['drawerCount', f.drawerCount] as const]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      errors.push({ code: 'INVALID_QUANTITY', field, message: `${field} must be a non-negative integer.` });
    }
  }

  if (input.includeShelves && !f.shelfCount) warnings.push({ code: 'INVALID_QUANTITY', field: 'shelfCount', message: 'Shelves are enabled but shelfCount is zero.' });
  if (input.includeDrawers && !f.drawerCount) warnings.push({ code: 'INVALID_QUANTITY', field: 'drawerCount', message: 'Drawers are enabled but drawerCount is zero.' });

  for (const [name, material] of [['carcass', input.carcassMaterial], ['back', input.backMaterial], ['shutter', input.shutterMaterial] as const]) {
    if (material && ((material.sheetWidth && material.sheetWidth < 1) || (material.sheetHeight && material.sheetHeight < 1))) {
      warnings.push({ code: 'MISSING_SHEET_SIZE', field: `${name}.sheetSize`, message: `${name} material has an invalid sheet dimension.` });
    }
  }

  return { errors, warnings, valid: errors.length === 0 };
}
