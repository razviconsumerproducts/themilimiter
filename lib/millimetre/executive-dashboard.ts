export type DashboardProjectStatus = 'DRAFT' | 'MEASUREMENT' | 'DESIGN' | 'CALCULATED' | 'QUOTED' | 'APPROVED' | 'PRODUCTION' | 'DELIVERED' | 'CLOSED';

export interface DashboardProject {
  status: DashboardProjectStatus;
  productionRequired: number;
  productionCompleted: number;
  openServiceCases: number;
  handoverReady: boolean;
}

export interface ExecutiveDashboardResult {
  activeProjects: number;
  productionProgressPercent: number;
  openServiceCases: number;
  handoverReady: number;
}

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function calculateExecutiveDashboard(projects: DashboardProject[]): ExecutiveDashboardResult {
  if (!Array.isArray(projects)) throw new Error('Dashboard projects must be an array.');

  let required = 0;
  let completed = 0;
  let openServiceCases = 0;
  let handoverReady = 0;

  for (const project of projects) {
    if (!Number.isFinite(project.productionRequired) || project.productionRequired < 0) throw new Error('Production required quantity must be non-negative.');
    if (!Number.isFinite(project.productionCompleted) || project.productionCompleted < 0) throw new Error('Production completed quantity must be non-negative.');
    if (project.productionCompleted > project.productionRequired) throw new Error('Production completed quantity cannot exceed required quantity.');
    if (!Number.isInteger(project.openServiceCases) || project.openServiceCases < 0) throw new Error('Open service case count must be a non-negative integer.');

    if (project.status !== 'CLOSED') required += project.productionRequired;
    if (project.status !== 'CLOSED') completed += project.productionCompleted;
    if (project.status !== 'CLOSED' && project.status !== 'DRAFT') openServiceCases += project.openServiceCases;
    if (project.handoverReady) handoverReady += 1;
  }

  const activeProjects = projects.filter((project) => project.status !== 'CLOSED').length;
  const productionProgressPercent = required === 0 ? 0 : round((completed / required) * 100);

  return { activeProjects, productionProgressPercent, openServiceCases, handoverReady };
}

export interface PipelineStageCount { stage: string; count: number; }

export function calculatePipelineStageCounts(projects: DashboardProject[]): PipelineStageCount[] {
  const counts = new Map<string, number>();
  for (const project of projects) counts.set(project.status, (counts.get(project.status) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([stage, count]) => ({ stage, count }));
}
