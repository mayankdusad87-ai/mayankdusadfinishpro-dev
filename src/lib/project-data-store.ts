import * as XLSX from 'xlsx';

export interface UploadedActivity {
  id: string;
  series: string;
  floor: number;
  flat_number: number;
  configuration: string;
  stage: string;
  stage_gate: string;
  activity: string;
  vendor: string;
  applicable: boolean;
  expected_start: string;
  expected_end: string;
  actual_start: string;
  actual_end: string;
  status: string;
  delay_days: number;
  delay_reason: string;
  remarks: string;
  rooms: Record<string, string>;
  sort_order: number;
  sub_stage_status: string;
  flat_status: string;
  floor_status: string;
  risk_status: string;
  revised_start: string;
  revised_end: string;
}

export interface ProjectData {
  projectId: string;
  name: string;
  uploadedAt: string;
  fileName: string;
  totalRows: number;
  activities: UploadedActivity[];
  stages: string[];
  stageGates: Record<string, string[]>;
  activityNames: Record<string, string[]>;
  vendors: string[];
  floors: number[];
  configurations: string[];
  statuses: string[];
}

// ---- Excel parsing ----

function excelDateToString(serial: number | string): string {
  if (!serial || serial === '') return '';
  const num = typeof serial === 'string' ? parseFloat(serial) : serial;
  if (isNaN(num) || num < 1000) return String(serial);
  const date = new Date((num - 25569) * 86400000);
  return date.toISOString().slice(0, 10);
}

function mapStatus(raw: string): string {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'yet to start' || s === '') return 'not_started';
  if (s === 'in progress') return 'in_progress';
  if (s === 'in progress with delay') return 'in_progress_delayed';
  if (s === 'completed') return 'completed';
  if (s === 'completed with delay') return 'completed_delayed';
  if (s === 'not applicable') return 'not_applicable';
  if (s === 'on hold') return 'on_hold';
  return 'not_started';
}

const ROOM_COLS = [
  { idx: 17, name: 'Living Area' },
  { idx: 18, name: 'Common Bedroom' },
  { idx: 19, name: 'Master Bedroom 1' },
  { idx: 20, name: 'Master Bedroom 2' },
  { idx: 21, name: 'M Toilet 1' },
  { idx: 22, name: 'M Toilet 2' },
  { idx: 23, name: 'C Toilet' },
  { idx: 24, name: 'Kitchen' },
];

export function parseExcelFile(buffer: ArrayBuffer, projectId: string): ProjectData {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets['Sale Unit wise status'];
  if (!ws) {
    throw new Error('Sheet "Sale Unit wise status" not found. Available sheets: ' + wb.SheetNames.join(', '));
  }

  const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { defval: '', header: 1, range: 0 });
  const dataRows = rawRows.slice(7);

  const activities: UploadedActivity[] = [];
  const stagesSet = new Set<string>();
  const vendorsSet = new Set<string>();
  const floorsSet = new Set<number>();
  const configsSet = new Set<string>();
  const statusesSet = new Set<string>();
  const stageGatesMap: Record<string, Set<string>> = {};
  const activityNamesMap: Record<string, Set<string>> = {};

  let rowId = 0;
  for (const row of dataRows) {
    const stage = String(row[5] || '').trim();
    const stageGate = String(row[6] || '').trim();
    const activity = String(row[7] || '').trim();
    const vendor = String(row[8] || '').trim();
    const config = String(row[4] || '').trim();
    const floorRaw = row[2];
    const flatRaw = row[3];
    const statusRaw = String(row[14] || '').trim();

    if (!stage || stage === 'X' || !activity || activity === 'X') continue;
    if (config === 'X') continue;

    const floor = typeof floorRaw === 'number' ? floorRaw : parseInt(String(floorRaw), 10);
    const flat = typeof flatRaw === 'number' ? flatRaw : parseInt(String(flatRaw), 10);
    if (isNaN(floor) || isNaN(flat)) continue;

    const mappedStatus = mapStatus(statusRaw);
    if (mappedStatus === 'not_applicable') continue;

    stagesSet.add(stage);
    vendorsSet.add(vendor);
    floorsSet.add(floor);
    configsSet.add(config);
    if (statusRaw) statusesSet.add(statusRaw);

    if (!stageGatesMap[stage]) stageGatesMap[stage] = new Set();
    stageGatesMap[stage].add(stageGate);

    const sgKey = `${stage}||${stageGate}`;
    if (!activityNamesMap[sgKey]) activityNamesMap[sgKey] = new Set();
    activityNamesMap[sgKey].add(activity);

    const rooms: Record<string, string> = {};
    for (const rc of ROOM_COLS) {
      const val = String(row[rc.idx] || '').trim();
      if (val && val !== 'X') rooms[rc.name] = val;
    }

    activities.push({
      id: `act_${rowId++}`,
      series: String(row[1] || ''),
      floor,
      flat_number: flat,
      configuration: config,
      stage,
      stage_gate: stageGate,
      activity,
      vendor,
      applicable: String(row[9] || '').trim().toLowerCase() !== 'no',
      expected_start: excelDateToString(row[10] as number),
      expected_end: excelDateToString(row[11] as number),
      actual_start: excelDateToString(row[12] as number),
      actual_end: excelDateToString(row[13] as number),
      status: mappedStatus,
      delay_days: typeof row[37] === 'number' ? row[37] : parseInt(String(row[37] || '0'), 10) || 0,
      delay_reason: String(row[16] || ''),
      remarks: String(row[25] || ''),
      rooms,
      sort_order: typeof row[26] === 'number' ? row[26] : 0,
      sub_stage_status: String(row[27] || ''),
      flat_status: String(row[36] || ''),
      floor_status: String(row[34] || ''),
      risk_status: String(row[38] || ''),
      revised_start: excelDateToString(row[28] as number),
      revised_end: excelDateToString(row[29] as number),
    });
  }

  const floors = [...floorsSet].sort((a, b) => a - b);

  return {
    projectId,
    name: 'Uploaded Project',
    uploadedAt: new Date().toISOString(),
    fileName: '',
    totalRows: activities.length,
    activities,
    stages: [...stagesSet],
    stageGates: Object.fromEntries(
      Object.entries(stageGatesMap).map(([k, v]) => [k, [...v]])
    ),
    activityNames: Object.fromEntries(
      Object.entries(activityNamesMap).map(([k, v]) => [k, [...v]])
    ),
    vendors: [...vendorsSet].filter(Boolean).sort(),
    floors,
    configurations: [...configsSet].filter(Boolean),
    statuses: [...statusesSet],
  };
}
