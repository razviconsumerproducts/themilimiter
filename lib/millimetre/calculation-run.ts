import { calculateFurniture } from './calculation';
import { validateCalculationInput } from './calculation-validation';
import type { CalculationInput, CalculationResult } from './domain';

export const CALCULATION_ENGINE_VERSION = 'V1.0.0';

export interface CalculationRunSnapshot {
  projectId: string;
  furnitureId: string;
  engineVersion: string;
  inputSnapshot: CalculationInput;
  outputSnapshot: CalculationResult | null;
  warnings: ReturnType<typeof validateCalculationInput>['warnings'];
  errors: ReturnType<typeof validateCalculationInput>['errors'];
  status: 'COMPLETED' | 'FAILED';
  calculatedAt: string;
}

/** Pure application boundary: calculate first, then return a persistence-ready immutable snapshot. */
export function createCalculationRun(input: CalculationInput, calculatedAt = new Date().toISOString()): CalculationRunSnapshot {
  const validation = validateCalculationInput(input);
  if (!validation.valid) {
    return {
      projectId: input.furniture.projectId,
      furnitureId: input.furniture.id,
      engineVersion: CALCULATION_ENGINE_VERSION,
      inputSnapshot: structuredClone(input),
      outputSnapshot: null,
      warnings: validation.warnings,
      errors: validation.errors,
      status: 'FAILED',
      calculatedAt,
    };
  }

  const result = calculateFurniture(input);
  return {
    projectId: input.furniture.projectId,
    furnitureId: input.furniture.id,
    engineVersion: CALCULATION_ENGINE_VERSION,
    inputSnapshot: structuredClone(input),
    outputSnapshot: structuredClone(result),
    warnings: validation.warnings,
    errors: [],
    status: 'COMPLETED',
    calculatedAt,
  };
}
