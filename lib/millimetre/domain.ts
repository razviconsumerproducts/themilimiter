export type Millimetre = number;
export type Currency = number;

export type ProjectStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type MeasurementType = 'room' | 'wall' | 'opening' | 'point' | 'custom';
export type FurnitureType = 'base_cabinet' | 'wall_cabinet' | 'tall_cabinet' | 'wardrobe' | 'drawer_unit' | 'shelf' | 'custom';
export type ComponentKind = 'panel' | 'shutter' | 'drawer_box' | 'drawer_front' | 'shelf' | 'back' | 'plinth' | 'edge_strip' | 'custom';
export type MaterialKind = 'board' | 'plywood' | 'mdf' | 'hdf' | 'solid_wood' | 'glass' | 'hardware' | 'other';
export type EdgeCode = 'none' | 'front' | 'back' | 'left' | 'right' | 'all';

export interface Project {
  id: string;
  projectNo: string;
  customerId: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Measurement {
  id: string;
  projectId: string;
  type: MeasurementType;
  name: string;
  width: Millimetre;
  height: Millimetre;
  depth?: Millimetre;
  notes?: string;
}

export interface Furniture {
  id: string;
  projectId: string;
  name: string;
  code: string;
  type: FurnitureType;
  width: Millimetre;
  height: Millimetre;
  depth: Millimetre;
  carcassThickness: Millimetre;
  backThickness?: Millimetre;
  shutterGap: Millimetre;
  shelfCount?: number;
  drawerCount?: number;
}

export interface Material {
  id: string;
  code: string;
  name: string;
  kind: MaterialKind;
  thickness: Millimetre;
  sheetWidth?: Millimetre;
  sheetHeight?: Millimetre;
  ratePerSheet?: Currency;
  ratePerSqM?: Currency;
}

export interface Component {
  id: string;
  furnitureId: string;
  kind: ComponentKind;
  name: string;
  qty: number;
  length: Millimetre;
  width: Millimetre;
  thickness: Millimetre;
  materialId: string;
  grain: boolean;
  edge: EdgeCode;
  edgeBandMm?: Millimetre;
  notes?: string;
}

export interface CalculationInput {
  furniture: Furniture;
  carcassMaterial: Material;
  backMaterial?: Material;
  shutterMaterial?: Material;
  includeBack: boolean;
  includeShutters: boolean;
  includeShelves: boolean;
  includeDrawers: boolean;
}

export interface CuttingPart extends Component {
  areaSqM: number;
  edgeLengthM: number;
}

export interface CalculationResult {
  furnitureId: string;
  parts: CuttingPart[];
  totalAreaSqM: number;
  totalEdgeLengthM: number;
  materialAreaSqM: Record<string, number>;
}

export interface CuttingList {
  projectId: string;
  furnitureId: string;
  generatedAt: string;
  parts: CuttingPart[];
}
