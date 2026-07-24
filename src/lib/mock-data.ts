import {
  ActivityRow,
  ActivityStatus,
  AuditLogEntry,
  FloorCoverageItem,
  Project,
  Supervisor,
  VendorPerformance,
} from './types';

const STAGES = [
  'Pre-Tiling', 'Tiling', 'Post Tiling', 'Pre Paint Activities',
  '1st Coat Paint', 'Post First Coat Paint', 'Second Coat Paint',
  'Post Second Coat Paint', 'Lobby Flooring',
];

const STAGE_GATES: Record<string, string[]> = {
  'Pre-Tiling': ['Gypsum Vendor', 'Plumbing', 'Electrical'],
  'Tiling': ['Floor Tiles', 'Wall Tiles', 'Bathroom Tiles'],
  'Post Tiling': ['Grouting', 'Cleaning'],
  'Pre Paint Activities': ['POP Punning', 'Putty Application', 'Sanding'],
  '1st Coat Paint': ['Primer Coat', 'First Coat'],
  'Post First Coat Paint': ['Touch Up', 'Inspection'],
  'Second Coat Paint': ['Second Coat', 'Final Coat'],
  'Post Second Coat Paint': ['Final Inspection', 'Handover Prep'],
  'Lobby Flooring': ['Lobby Tiles', 'Polishing'],
};

const ACTIVITIES = [
  'POP Punning', 'Putty Application', 'Primer Coat', 'Bathroom Wall Tiles',
  'Wiring & Cabling', 'Wardrobe Installation', 'Living Room Floor Tiles',
  'Switch & Socket Installation', 'CP Fitting', 'Top Coat', 'Kitchen Wall Tiles',
  'Main Door Frame', 'Window Glass Installation', 'Gypsum Board Installation',
  'Vitrified Tile Flooring', 'Wall Putty', 'Switch Board Installation',
  'Skirting Tiles', 'Balcony Waterproofing', 'Toilet Accessories',
];

const VENDORS = [
  'ColorCraft', 'TileWorks', 'VoltEdge', 'WoodArt', 'AquaFlow',
  'BuildMax Supplies', 'ConcreteCo', 'SteelWorks Ltd.', 'Prime Electricals',
  'PlumbPro Services', 'TileCrafts', 'SafetyFirst Equip.', 'WoodLine Interiors',
  'BuildTech Interiors', 'Supreme Floors', 'ColourCraft Painters', 'Alpha Electricals',
];

const CONFIGURATIONS = ['2BHK', '3BHK', '4BHK'];

export const projects: Project[] = [
  {
    id: 'p1',
    tenant_id: 't1',
    name: 'Skyline Heights - Tower A',
    location: 'Dubai, UAE',
    status: 'active',
    start_date: '2024-05-12',
    target_end_date: '2025-12-31',
    total_floors: 45,
    total_flats: 540,
    created_at: '2024-05-12',
  },
  {
    id: 'p2',
    tenant_id: 't1',
    name: 'Harbor View Towers',
    location: 'Abu Dhabi, UAE',
    status: 'active',
    start_date: '2024-04-28',
    target_end_date: '2025-10-31',
    total_floors: 38,
    total_flats: 456,
    created_at: '2024-04-28',
  },
  {
    id: 'p3',
    tenant_id: 't1',
    name: 'Greenfield Apartments',
    location: 'Sharjah, UAE',
    status: 'active',
    start_date: '2024-04-18',
    target_end_date: '2025-09-30',
    total_floors: 26,
    total_flats: 312,
    created_at: '2024-04-18',
  },
  {
    id: 'p4',
    tenant_id: 't1',
    name: 'Sunset Community',
    location: 'Ajman, UAE',
    status: 'active',
    start_date: '2024-04-07',
    target_end_date: '2025-08-31',
    total_floors: 18,
    total_flats: 216,
    created_at: '2024-04-07',
  },
  {
    id: 'p5',
    tenant_id: 't1',
    name: 'Marina Heights',
    location: 'Dubai, UAE',
    status: 'active',
    start_date: '2024-03-01',
    target_end_date: '2025-06-30',
    total_floors: 52,
    total_flats: 624,
    created_at: '2024-03-01',
  },
];

function randomDate(start: string, end: string): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString().split('T')[0];
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateActivities(): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const statuses: ActivityStatus[] = ['not_started', 'in_progress', 'completed', 'delayed', 'on_hold'];
  const statusWeights = [0.25, 0.40, 0.26, 0.06, 0.03];

  for (let floor = 3; floor <= 18; floor++) {
    const flatsPerFloor = floor <= 10 ? 10 : 8;
    for (let flatIdx = 1; flatIdx <= flatsPerFloor; flatIdx++) {
      const flatNum = `${floor}0${flatIdx}`;
      const config = randomFrom(CONFIGURATIONS);
      const numActivities = 3 + Math.floor(Math.random() * 4);

      for (let a = 0; a < numActivities; a++) {
        const stage = randomFrom(STAGES);
        const gatesForStage = STAGE_GATES[stage] || ['Gate 1'];
        const gate = randomFrom(gatesForStage);
        const activity = randomFrom(ACTIVITIES);
        const vendor = randomFrom(VENDORS);

        const rand = Math.random();
        let cumulative = 0;
        let status: ActivityStatus = 'not_started';
        for (let i = 0; i < statuses.length; i++) {
          cumulative += statusWeights[i];
          if (rand <= cumulative) {
            status = statuses[i];
            break;
          }
        }

        const expectedStart = randomDate('2025-04-01', '2025-06-30');
        const expectedEnd = randomDate(expectedStart, '2025-08-31');
        let actualStart: string | undefined;
        let actualEnd: string | undefined;

        if (status === 'in_progress' || status === 'completed' || status === 'delayed') {
          actualStart = randomDate('2025-04-01', '2025-06-15');
        }
        if (status === 'completed') {
          actualEnd = randomDate(actualStart || '2025-05-01', '2025-07-31');
        }

        rows.push({
          id: `ar-${floor}-${flatIdx}-${a}`,
          tenant_id: 't1',
          project_id: 'p1',
          flat_id: `f-${floor}-${flatIdx}`,
          finishing_activity_id: `fa-${a}`,
          vendor_name: vendor,
          expected_start_date: expectedStart,
          expected_end_date: expectedEnd,
          actual_start_date: actualStart,
          actual_end_date: actualEnd,
          status,
          hold_reason_category: status === 'on_hold' ? randomFrom(['vendor_delay', 'material_shortage', 'structural', 'weather', 'other']) : undefined,
          hold_reason_notes: status === 'on_hold' ? 'Hoist obstruction on this series' : undefined,
          delay_reason_notes: status === 'delayed' ? 'Vendor material delayed' : undefined,
          is_applicable: true,
          last_updated_by: 'u1',
          last_updated_at: randomDate('2025-05-01', '2025-05-31'),
          floor_number: floor,
          floor_label: `${floor}th Floor`,
          flat_number: flatNum,
          configuration: config,
          stage_name: stage,
          stage_gate_name: gate,
          activity_name: activity,
        });
      }
    }
  }
  return rows;
}

export const activityRows = generateActivities();

export const statusCounts = {
  total: activityRows.length,
  not_started: activityRows.filter(r => r.status === 'not_started').length,
  in_progress: activityRows.filter(r => r.status === 'in_progress').length,
  completed: activityRows.filter(r => r.status === 'completed').length,
  delayed: activityRows.filter(r => r.status === 'delayed').length,
  on_hold: activityRows.filter(r => r.status === 'on_hold').length,
};

export const supervisors: Supervisor[] = [
  {
    id: 'u2',
    tenant_id: 't1',
    role: 'supervisor',
    full_name: 'James Carter',
    email: 'james.carter@fp.com',
    phone: '+971 55 123 4567',
    is_active: true,
    last_login_at: new Date().toISOString(),
    assigned_projects: ['p1'],
    assigned_floors: [3, 4, 5, 6],
    project_name: 'Riverside Tower – Main Contract',
    status_label: 'On Site',
  },
  {
    id: 'u3',
    tenant_id: 't1',
    role: 'supervisor',
    full_name: 'Sarah Malik',
    email: 'sarah.malik@fp.com',
    phone: '+971 55 234 5678',
    is_active: true,
    last_login_at: new Date(Date.now() - 86400000).toISOString(),
    assigned_projects: ['p1'],
    assigned_floors: [7, 8, 9],
    project_name: 'Riverside Tower – Main Contract',
    status_label: 'On Site',
  },
  {
    id: 'u4',
    tenant_id: 't1',
    role: 'supervisor',
    full_name: 'Ravi Singh',
    email: 'ravi.singh@fp.com',
    phone: '+971 55 345 6789',
    is_active: true,
    last_login_at: new Date(Date.now() - 86400000).toISOString(),
    assigned_projects: ['p1'],
    assigned_floors: [10, 11, 12, 13],
    project_name: 'Riverside Tower – Main Contract',
    status_label: 'Busy',
  },
  {
    id: 'u5',
    tenant_id: 't1',
    role: 'supervisor',
    full_name: 'Ali Hassan',
    email: 'ali.hassan@fp.com',
    phone: '+971 50 456 7890',
    is_active: false,
    last_login_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    assigned_projects: ['p1'],
    assigned_floors: [14, 15],
    project_name: 'Riverside Tower – Main Contract',
    status_label: 'Inactive',
  },
  {
    id: 'u6',
    tenant_id: 't1',
    role: 'supervisor',
    full_name: 'Michael Lee',
    email: 'michael.lee@fp.com',
    phone: '+571 52 567 8901',
    is_active: true,
    last_login_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    assigned_projects: ['p1'],
    assigned_floors: [16, 17, 18],
    project_name: 'Riverside Tower – Main Contract',
    status_label: 'Suspended',
  },
];

export const auditLog: AuditLogEntry[] = [
  {
    id: 'al1', tenant_id: 't1', project_id: 'p1', entity_type: 'activity_row', entity_id: 'ar-12-3-1',
    field_changed: 'Expected End Date', old_value: '08-05-26', new_value: '19-05-26',
    change_type: 'date_change', changed_by: 'u1', changed_by_name: 'Admin User', changed_by_role: 'admin',
    changed_at: '2026-05-19T09:42:00Z', ip_address: '192.168.1.45', user_agent: 'Chrome / Win11',
    project_name: 'Skyline Residences', floor_label: 'Level 12', flat_number: 'Unit 1203', activity_name: 'POP Punning',
  },
  {
    id: 'al2', tenant_id: 't1', project_id: 'p1', entity_type: 'activity_row', entity_id: 'ar-10-2-1',
    field_changed: 'Status', old_value: 'In Progress', new_value: 'On Hold',
    change_type: 'status_change', changed_by: 'u3', changed_by_name: 'Sarah Martin', changed_by_role: 'supervisor',
    changed_at: '2026-05-19T09:15:00Z', ip_address: '192.168.1.78', user_agent: 'Chrome / Android',
    project_name: 'Skyline Residences', floor_label: 'Level 10', flat_number: 'Common Area',
  },
  {
    id: 'al3', tenant_id: 't1', project_id: 'p1', entity_type: 'activity_row', entity_id: 'ar-8-1-1',
    field_changed: 'Vendor', old_value: 'Vendor A', new_value: 'Vendor B',
    change_type: 'vendor_change', changed_by: 'u1', changed_by_name: 'Admin User', changed_by_role: 'admin',
    changed_at: '2026-05-18T16:33:00Z', ip_address: '192.168.1.45', user_agent: 'Edge / Win 11',
    project_name: 'Skyline Residences', floor_label: 'Level 8', flat_number: 'Unit 801',
  },
  {
    id: 'al4', tenant_id: 't1', project_id: 'p1', entity_type: 'activity_row', entity_id: 'ar-5-2-1',
    field_changed: 'Status', old_value: 'Not Started', new_value: 'In Progress',
    change_type: 'status_change', changed_by: 'u4', changed_by_name: 'Rohit Joshi', changed_by_role: 'supervisor',
    changed_at: '2026-05-18T14:11:00Z', ip_address: '192.168.1.92', user_agent: 'Chrome / Android',
    project_name: 'Skyline Residences', floor_label: 'Level 5', flat_number: 'Unit 502',
  },
  {
    id: 'al5', tenant_id: 't1', project_id: 'p1', entity_type: 'activity_row', entity_id: 'ar-12-3-2',
    field_changed: 'Expected End Date', old_value: '25-05-26', new_value: '06-05-26',
    change_type: 'date_change', changed_by: 'u1', changed_by_name: 'Admin User', changed_by_role: 'admin',
    changed_at: '2026-05-18T11:05:00Z', ip_address: '192.168.1.45', user_agent: 'Chrome / Win 11',
    project_name: 'Skyline Residences', floor_label: 'Level 12', flat_number: 'Unit 1203',
  },
  {
    id: 'al6', tenant_id: 't1', project_id: 'p1', entity_type: 'activity_row', entity_id: 'ar-3-1-1',
    field_changed: 'Status', old_value: 'In Progress', new_value: 'Completed',
    change_type: 'status_change', changed_by: 'u3', changed_by_name: 'Sarah Martin', changed_by_role: 'supervisor',
    changed_at: '2026-05-17T17:47:00Z', ip_address: '192.168.1.78', user_agent: 'Chrome / Android',
    project_name: 'Skyline Residences', floor_label: 'Level 3', flat_number: 'Common Area',
  },
  {
    id: 'al7', tenant_id: 't1', project_id: 'p1', entity_type: 'activity_row', entity_id: 'ar-7-1-1',
    field_changed: 'Vendor', old_value: 'Vendor A', new_value: 'Vendor B',
    change_type: 'vendor_change', changed_by: 'u1', changed_by_name: 'Admin User', changed_by_role: 'admin',
    changed_at: '2026-05-17T15:22:00Z', ip_address: '192.168.1.45', user_agent: 'Edge / Win 11',
    project_name: 'Skyline Residences', floor_label: 'Level 7', flat_number: 'Unit 701',
  },
  {
    id: 'al8', tenant_id: 't1', project_id: 'p1', entity_type: 'activity_row', entity_id: 'ar-2-1-1',
    field_changed: 'Status', old_value: 'On Hold', new_value: 'In Progress',
    change_type: 'status_change', changed_by: 'u4', changed_by_name: 'Rohit Joshi', changed_by_role: 'supervisor',
    changed_at: '2026-05-16T10:18:00Z', ip_address: '192.168.1.92', user_agent: 'Chrome / Android',
    project_name: 'Skyline Residences', floor_label: 'Level 2', flat_number: 'Unit 201',
  },
  {
    id: 'al9', tenant_id: 't1', project_id: 'p1', entity_type: 'activity_row', entity_id: 'ar-1-3-1',
    field_changed: 'Expected End Date', old_value: '30-05-26', new_value: '25-03-26',
    change_type: 'date_change', changed_by: 'u1', changed_by_name: 'Admin User', changed_by_role: 'admin',
    changed_at: '2026-05-15T09:03:00Z', ip_address: '192.168.1.45', user_agent: 'Chrome / Win 11',
    project_name: 'Skyline Residences', floor_label: 'Level 1', flat_number: 'Unit 103',
  },
];

export const vendorPerformance: VendorPerformance[] = [
  { vendor: 'BuildMax Supplies', on_time_pct: 78, delayed_pct: 22 },
  { vendor: 'ConcreteCo', on_time_pct: 65, delayed_pct: 35 },
  { vendor: 'SteelWorks Ltd.', on_time_pct: 58, delayed_pct: 42 },
  { vendor: 'Prime Electricals', on_time_pct: 82, delayed_pct: 18 },
  { vendor: 'PlumbPro Services', on_time_pct: 49, delayed_pct: 51 },
  { vendor: 'TileCrafts', on_time_pct: 73, delayed_pct: 27 },
  { vendor: 'SafetyFirst Equip.', on_time_pct: 90, delayed_pct: 10 },
  { vendor: 'WoodLine Interiors', on_time_pct: 40, delayed_pct: 60 },
];

export const floorCoverage: FloorCoverageItem[] = [
  { floor_number: 3, floor_label: '3rd Floor', supervisors: [{ name: 'James Carter', color: '#E67E22' }] },
  { floor_number: 4, floor_label: '4th Floor', supervisors: [{ name: 'James Carter', color: '#E67E22' }] },
  { floor_number: 5, floor_label: '5th Floor', supervisors: [{ name: 'James Carter', color: '#E67E22' }] },
  { floor_number: 6, floor_label: '6th Floor', supervisors: [{ name: 'James Carter', color: '#E67E22' }, { name: 'Sarah Malik', color: '#3498DB' }] },
  { floor_number: 7, floor_label: '7th Floor', supervisors: [{ name: 'Sarah Malik', color: '#3498DB' }] },
  { floor_number: 8, floor_label: '8th Floor', supervisors: [{ name: 'Sarah Malik', color: '#3498DB' }] },
  { floor_number: 9, floor_label: '9th Floor', supervisors: [{ name: 'Sarah Malik', color: '#3498DB' }] },
  { floor_number: 10, floor_label: '10th Floor', supervisors: [{ name: 'Ravi Singh', color: '#2ECC71' }] },
  { floor_number: 11, floor_label: '11th Floor', supervisors: [{ name: 'Ravi Singh', color: '#2ECC71' }] },
  { floor_number: 12, floor_label: '12th Floor', supervisors: [{ name: 'Ravi Singh', color: '#2ECC71' }] },
  { floor_number: 13, floor_label: '13th Floor', supervisors: [{ name: 'Ravi Singh', color: '#2ECC71' }, { name: 'Ali Hassan', color: '#9B59B6' }] },
  { floor_number: 14, floor_label: '14th Floor', supervisors: [{ name: 'Ali Hassan', color: '#9B59B6' }] },
  { floor_number: 15, floor_label: '15th Floor', supervisors: [{ name: 'Ali Hassan', color: '#9B59B6' }] },
  { floor_number: 16, floor_label: '16th Floor', supervisors: [{ name: 'Michael Lee', color: '#E74C3C' }] },
  { floor_number: 17, floor_label: '17th Floor', supervisors: [{ name: 'Michael Lee', color: '#E74C3C' }] },
  { floor_number: 18, floor_label: '18th Floor', supervisors: [{ name: 'Michael Lee', color: '#E74C3C' }] },
];

export const floorsConfig = [
  { floor: 'Basement 2', start_flat: '-', end_flat: '-', flats_count: 0, configuration: 'Parking / Services' },
  { floor: 'Basement 1', start_flat: '-', end_flat: '-', flats_count: 0, configuration: 'Parking / Services' },
  { floor: 'Ground Floor', start_flat: '01', end_flat: '12', flats_count: 12, configuration: 'Retail / Lobby' },
  { floor: '1st Floor', start_flat: '101', end_flat: '110', flats_count: 10, configuration: 'Residential' },
  { floor: '2nd Floor', start_flat: '201', end_flat: '210', flats_count: 10, configuration: 'Residential' },
  { floor: '3rd Floor', start_flat: '301', end_flat: '310', flats_count: 10, configuration: 'Residential' },
];

export const criticalDelays = activityRows
  .filter(r => r.status === 'delayed')
  .slice(0, 5)
  .map((r, i) => ({
    id: r.id,
    rank: i + 1,
    flat: `Flat ${r.flat_number}`,
    activity: r.activity_name || '',
    floor: r.floor_label || '',
    stagegate: r.stage_gate_name || '',
    vendor: r.vendor_name,
    overdue_days: Math.floor(Math.random() * 5) + 1,
  }));
