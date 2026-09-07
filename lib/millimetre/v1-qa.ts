export type QaSeverity = 'ERROR' | 'WARNING';

export type QaIssue = {
  code: string;
  severity: QaSeverity;
  stage: string;
  message: string;
};

export type V1QaInput = {
  projectExists: boolean;
  furnitureExists: boolean;
  measurementLinked: boolean;
  calculationValid: boolean;
  cuttingListReleased: boolean;
  bomReleased: boolean;
  optimizationApproved: boolean;
  costingApproved: boolean;
  quotationAccepted: boolean;
  commercialGateReleased: boolean;
  purchaseReleased: boolean;
  receiptQcComplete: boolean;
  inventoryPosted: boolean;
  productionComplete: boolean;
  productionQcReleased: boolean;
  labelsReady: boolean;
  deliveryReady: boolean;
  installationComplete: boolean;
  handoverAccepted: boolean;
  warrantyActive: boolean;
};

export type V1QaResult = {
  passed: boolean;
  issues: QaIssue[];
  completedStages: number;
  totalStages: number;
};

const stages: Array<[keyof V1QaInput, string]> = [
  ['projectExists', 'CUSTOMER + PROJECT'],
  ['measurementLinked', 'MEASUREMENTS'],
  ['furnitureExists', 'FURNITURE DESIGN'],
  ['calculationValid', 'CALCULATION'],
  ['cuttingListReleased', 'CUTTING LIST'],
  ['bomReleased', 'BOM / BOQ'],
  ['optimizationApproved', 'SHEET OPTIMIZATION'],
  ['costingApproved', 'COSTING'],
  ['quotationAccepted', 'QUOTATION'],
  ['commercialGateReleased', 'APPROVAL / PAYMENT'],
  ['purchaseReleased', 'PURCHASE'],
  ['receiptQcComplete', 'GOODS RECEIPT + QC'],
  ['inventoryPosted', 'INVENTORY'],
  ['productionComplete', 'PRODUCTION'],
  ['productionQcReleased', 'PRODUCTION QC'],
  ['labelsReady', 'LABELS / QR'],
  ['deliveryReady', 'DELIVERY'],
  ['installationComplete', 'INSTALLATION'],
  ['handoverAccepted', 'HANDOVER'],
  ['warrantyActive', 'WARRANTY / SERVICE'],
];

export function calculateV1Qa(input: V1QaInput): V1QaResult {
  const issues: QaIssue[] = [];

  for (const [key, stage] of stages) {
    if (!input[key]) {
      issues.push({
        code: `STAGE_NOT_READY_${key.toUpperCase()}`,
        severity: 'ERROR',
        stage,
        message: `${stage} is not complete or its release gate is not satisfied`,
      });
    }
  }

  if (input.commercialGateReleased && !input.quotationAccepted) {
    issues.push({
      code: 'COMMERCIAL_GATE_WITHOUT_ACCEPTED_QUOTATION',
      severity: 'ERROR',
      stage: 'APPROVAL / PAYMENT',
      message: 'Commercial release cannot be valid without an accepted quotation',
    });
  }

  if (input.purchaseReleased && !input.commercialGateReleased) {
    issues.push({
      code: 'PURCHASE_WITHOUT_COMMERCIAL_RELEASE',
      severity: 'ERROR',
      stage: 'PURCHASE',
      message: 'Purchase release requires the commercial gate to be released',
    });
  }

  if (input.inventoryPosted && !input.receiptQcComplete) {
    issues.push({
      code: 'INVENTORY_WITHOUT_RECEIPT_QC',
      severity: 'ERROR',
      stage: 'INVENTORY',
      message: 'Inventory posting requires completed goods-receipt QC',
    });
  }

  if (input.productionQcReleased && !input.productionComplete) {
    issues.push({
      code: 'PRODUCTION_QC_BEFORE_PRODUCTION_COMPLETE',
      severity: 'ERROR',
      stage: 'PRODUCTION QC',
      message: 'Production QC release requires production completion',
    });
  }

  if (input.deliveryReady && !input.productionQcReleased) {
    issues.push({
      code: 'DELIVERY_BEFORE_PRODUCTION_RELEASE',
      severity: 'ERROR',
      stage: 'DELIVERY',
      message: 'Delivery readiness requires production QC release',
    });
  }

  if (input.handoverAccepted && !input.installationComplete) {
    issues.push({
      code: 'HANDOVER_BEFORE_INSTALLATION_COMPLETE',
      severity: 'ERROR',
      stage: 'HANDOVER',
      message: 'Handover acceptance requires installation completion',
    });
  }

  if (input.warrantyActive && !input.handoverAccepted) {
    issues.push({
      code: 'WARRANTY_BEFORE_HANDOVER',
      severity: 'ERROR',
      stage: 'WARRANTY / SERVICE',
      message: 'Warranty activation requires accepted handover',
    });
  }

  const completedStages = stages.filter(([key]) => input[key]).length;

  return {
    passed: issues.every((issue) => issue.severity !== 'ERROR'),
    issues,
    completedStages,
    totalStages: stages.length,
  };
}
