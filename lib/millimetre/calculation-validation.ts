import type { CalculationInput, Material } from './domain';

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

const positive = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
};

export function validateCalculationInput(input: CalculationInput): CalculationValidation {
  const errors: CalculationIssue[] = [];
  const warnings: CalculationIssue[] = [];
  const f = input.furniture;

  const dimensions: ReadonlyArray<readonly [string, unknown]> = [
    ['width', f.width],
    ['height', f.height],
    ['depth', f.depth],
    ['carcassThickness', f.carcassThickness],
  ];

  for (const [field, value] of dimensions) {
    if (!positive(value)) {
      errors.push({
        code: 'INVALID_DIMENSION',
        field,
        message: `${field} must be greater than zero.`,
      });
    }
  }

  if (!positive(input.carcassMaterial.thickness)) {
    errors.push({
      code: 'INVALID_THICKNESS',
      field: 'carcassMaterial.thickness',
      message: 'Carcass material thickness must be greater than zero.',
    });
  }
  if (!input.carcassMaterial.id) {
    errors.push({
      code: 'MISSING_MATERIAL',
      field: 'carcassMaterial',
      message: 'A carcass material is required.',
    });
  }

  if (input.includeBack) {
    if (!input.backMaterial?.id) {
      errors.push({
        code: 'MISSING_MATERIAL',
        field: 'backMaterial',
        message: 'Back material is required when back is enabled.',
      });
    } else if (!positive(input.backMaterial.thickness)) {
      errors.push({
        code: 'INVALID_THICKNESS',
        field: 'backMaterial.thickness',
        message: 'Back material thickness must be greater than zero.',
      });
    }
  }

  if (input.includeShutters) {
    if (!input.shutterMaterial?.id) {
      errors.push({
        code: 'MISSING_MATERIAL',
        field: 'shutterMaterial',
        message: 'Shutter material is required when shutters are enabled.',
      });
    }
    const shutterGap = Number(f.shutterGap);
    if (!Number.isFinite(shutterGap) || shutterGap < 0) {
      errors.push({
        code: 'INVALID_DIMENSION',
        field: 'shutterGap',
        message: 'Shutter gap cannot be negative.',
      });
    }
  }

  const quantities: ReadonlyArray<readonly [string, unknown]> = [
    ['shelfCount', f.shelfCount],
    ['drawerCount', f.drawerCount],
  ];

  for (const [field, value] of quantities) {
    if (value !== undefined && (!Number.isInteger(Number(value)) || Number(value) < 0)) {
      errors.push({
        code: 'INVALID_QUANTITY',
        field,
        message: `${field} must be a non-negative integer.`,
      });
    }
  }

  if (input.includeShelves && !Number(f.shelfCount)) {
    warnings.push({
      code: 'INVALID_QUANTITY',
      field: 'shelfCount',
      message: 'Shelves are enabled but shelfCount is zero.',
    });
  }
  if (input.includeDrawers && !Number(f.drawerCount)) {
    warnings.push({
      code: 'INVALID_QUANTITY',
      field: 'drawerCount',
      message: 'Drawers are enabled but drawerCount is zero.',
    });
  }

  const materials: ReadonlyArray<readonly [string, Material | undefined]> = [
    ['carcass', input.carcassMaterial],
    ['back', input.backMaterial],
    ['shutter', input.shutterMaterial],
  ];

  for (const [name, material] of materials) {
    if (!material) continue;
    const sheetWidth = Number(material.sheetWidth);
    const sheetHeight = Number(material.sheetHeight);
    if (
      (material.sheetWidth !== undefined && (!Number.isFinite(sheetWidth) || sheetWidth < 1)) ||
      (material.sheetHeight !== undefined && (!Number.isFinite(sheetHeight) || sheetHeight < 1))
    ) {
      warnings.push({
        code: 'MISSING_SHEET_SIZE',
        field: `${name}.sheetSize`,
        message: `${name} material has an invalid sheet dimension.`,
      });
    }
  }

  return { errors, warnings, valid: errors.length === 0 };
}
