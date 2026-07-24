export interface ActivityConfig {
  stages: string[];
  subStages: Record<string, string[]>;
  activities: Record<string, string[]>;
}

const STORAGE_KEY = 'finishing_pro_activity_config';

const DEFAULT_CONFIG: ActivityConfig = {
  stages: [],
  subStages: {},
  activities: {},
};

export function getActivityConfig(): ActivityConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return JSON.parse(raw) as ActivityConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveActivityConfig(config: ActivityConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function parseExcelToConfig(data: Record<string, string>[]): ActivityConfig {
  const stages = new Set<string>();
  const subStages: Record<string, Set<string>> = {};
  const activities: Record<string, Set<string>> = {};

  for (const row of data) {
    const stage = (row['Stage'] || row['stage'] || '').trim();
    const subStage = (row['Sub Stage'] || row['SubStage'] || row['sub_stage'] || row['Sub stage'] || '').trim();
    const activity = (row['Activity'] || row['Activities'] || row['activity'] || row['activities'] || '').trim();

    if (stage) {
      stages.add(stage);
      if (!subStages[stage]) subStages[stage] = new Set();
      if (subStage) {
        subStages[stage].add(subStage);
        const key = `${stage}||${subStage}`;
        if (!activities[key]) activities[key] = new Set();
        if (activity) activities[key].add(activity);
      }
    }
  }

  return {
    stages: [...stages],
    subStages: Object.fromEntries(
      Object.entries(subStages).map(([k, v]) => [k, [...v]])
    ),
    activities: Object.fromEntries(
      Object.entries(activities).map(([k, v]) => [k, [...v]])
    ),
  };
}
