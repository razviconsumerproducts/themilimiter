export type DeliveryStatus = 'PLANNED' | 'READY' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'PARTIAL' | 'CANCELLED';
export type InstallationStatus = 'SCHEDULED' | 'ASSIGNED' | 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';

export interface InstallationQuantityInput { planned: number; installed: number; rejected: number; }
export interface InstallationQuantityResult { remaining: number; installable: number; complete: boolean; }

export function calculateInstallationQuantity(input: InstallationQuantityInput): InstallationQuantityResult {
  for (const value of [input.planned, input.installed, input.rejected]) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Installation quantities must be finite and non-negative');
  }
  if (input.planned <= 0) throw new Error('Planned installation quantity must be greater than zero');
  if (input.installed + input.rejected > input.planned) throw new Error('Installed plus rejected quantity cannot exceed planned quantity');
  const remaining = input.planned - input.installed - input.rejected;
  return { remaining, installable: input.planned - input.rejected, complete: remaining === 0 };
}

export interface DeliveryReadinessInput { plannedQuantity: number; loadedQuantity: number; blocked?: boolean; }
export interface DeliveryReadinessResult { ready: boolean; remaining: number; }

export function evaluateDeliveryReadiness(input: DeliveryReadinessInput): DeliveryReadinessResult {
  for (const value of [input.plannedQuantity, input.loadedQuantity]) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Delivery quantities must be finite and non-negative');
  }
  if (input.plannedQuantity <= 0) throw new Error('Planned delivery quantity must be greater than zero');
  if (input.loadedQuantity > input.plannedQuantity) throw new Error('Loaded quantity cannot exceed planned quantity');
  return { ready: !input.blocked && input.loadedQuantity === input.plannedQuantity, remaining: input.plannedQuantity - input.loadedQuantity };
}

export function canCompleteInstallation(input: InstallationQuantityInput, customerSigned: boolean): boolean {
  const result = calculateInstallationQuantity(input);
  return result.complete && customerSigned;
}
