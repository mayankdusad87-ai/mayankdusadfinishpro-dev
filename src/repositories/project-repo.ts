import { supabase } from '@/lib/supabase';
import type { ManagedProject } from '@/lib/project-store';
import type { UploadedActivity, ProjectData } from '@/lib/project-data-store';
import type { ProjectRow } from '@/types/database.types';
import { friendlyError } from './errors';

function projectRowToManaged(row: Pick<ProjectRow, 'id' | 'name' | 'location' | 'status' | 'total_floors' | 'total_flats' | 'created_at' | 'has_template'>): ManagedProject {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    status: (row.status || 'active') as 'active' | 'completed' | 'on_hold',
    totalFloors: row.total_floors ?? 0,
    totalFlats: row.total_flats ?? 0,
    createdAt: row.created_at ?? '',
    hasTemplate: row.has_template ?? false,
  };
}

export async function getProjectsFromSupabase(): Promise<ManagedProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, location, status, total_floors, total_flats, created_at, has_template')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(projectRowToManaged);
}

export async function getProjectFromSupabase(id: string): Promise<ManagedProject | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, location, status, total_floors, total_flats, created_at, has_template')
    .eq('id', id)
    .single();

  if (error) return null;
  return projectRowToManaged(data);
}

export async function saveProjectToSupabase(project: ManagedProject, createdBy?: string): Promise<string> {
  const isNew = project.id.startsWith('proj_');

  if (isNew) {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: project.name,
        location: project.location,
        status: project.status,
        total_floors: project.totalFloors,
        total_flats: project.totalFlats,
        has_template: project.hasTemplate,
        created_by: createdBy ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  } else {
    const { error } = await supabase
      .from('projects')
      .update({
        name: project.name,
        location: project.location,
        status: project.status,
        total_floors: project.totalFloors,
        total_flats: project.totalFlats,
        has_template: project.hasTemplate,
      })
      .eq('id', project.id);
    if (error) throw error;
    return project.id;
  }
}

export async function deleteProjectFromSupabase(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export async function getProjectFloors(projectId: string): Promise<number[]> {
  const [activitiesRes, projectRes] = await Promise.all([
    supabase.from('activities').select('floor').eq('project_id', projectId).limit(50000),
    supabase.from('projects').select('total_floors').eq('id', projectId).single(),
  ]);
  const activityFloors = new Set(
    (activitiesRes.data || []).map((r: { floor: number }) => r.floor)
  );
  const totalFloors = projectRes.data?.total_floors || 0;
  if (totalFloors > 0) {
    for (let i = 1; i <= totalFloors; i++) activityFloors.add(i);
  }
  return [...activityFloors].sort((a, b) => a - b);
}

export async function getRefugeConfig(projectId: string): Promise<{ floors: number[]; units: number[] }> {
  const { data, error } = await supabase
    .from('projects')
    .select('refuge_floors, refuge_units')
    .eq('id', projectId)
    .single();
  if (error || !data) return { floors: [], units: [] };
  return {
    floors: data.refuge_floors || [],
    units: data.refuge_units || [],
  };
}

export async function saveRefugeConfig(
  projectId: string,
  refugeFloors: number[],
  refugeUnits: number[]
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('projects')
    .update({ refuge_floors: refugeFloors, refuge_units: refugeUnits })
    .eq('id', projectId);
  if (error) return { error: friendlyError(error.message, 'update project settings') };
  return { error: null };
}

export async function getProjectDataFromSupabase(projectId: string): Promise<ProjectData | null> {
  const { getActivitiesFromSupabase } = await import('./activity-repo');
  const activities = await getActivitiesFromSupabase(projectId);
  if (activities.length === 0) return null;

  const project = await getProjectFromSupabase(projectId);
  return buildProjectData(projectId, activities, project?.name);
}

/**
 * Lightweight variant for supervisor pages:
 *  - Uses getSupervisorActivities (selective columns + server-side floor filter)
 *  - Returns the same ProjectData shape so the UI works unchanged
 */
export async function getSupervisorProjectData(
  projectId: string,
  assignedFloors?: number[] | null
): Promise<ProjectData | null> {
  const { getSupervisorActivities } = await import('./activity-repo');
  const activities = await getSupervisorActivities(projectId, assignedFloors);
  if (activities.length === 0) return null;

  const project = await getProjectFromSupabase(projectId);
  return buildProjectData(projectId, activities, project?.name);
}

/** Shared helper — derives metadata from an activities array */
function buildProjectData(
  projectId: string,
  activities: UploadedActivity[],
  projectName?: string
): ProjectData {
  const stagesSet = new Set<string>();
  const vendorsSet = new Set<string>();
  const floorsSet = new Set<number>();
  const configsSet = new Set<string>();
  const statusesSet = new Set<string>();
  const stageGatesMap: Record<string, Set<string>> = {};
  const activityNamesMap: Record<string, Set<string>> = {};

  for (const a of activities) {
    stagesSet.add(a.stage);
    if (a.vendor) vendorsSet.add(a.vendor);
    floorsSet.add(a.floor);
    if (a.configuration) configsSet.add(a.configuration);
    if (a.status) statusesSet.add(a.status);

    if (!stageGatesMap[a.stage]) stageGatesMap[a.stage] = new Set();
    stageGatesMap[a.stage].add(a.stage_gate);

    const sgKey = `${a.stage}||${a.stage_gate}`;
    if (!activityNamesMap[sgKey]) activityNamesMap[sgKey] = new Set();
    activityNamesMap[sgKey].add(a.activity);
  }

  return {
    projectId,
    name: projectName || 'Project',
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
    floors: [...floorsSet].sort((a, b) => a - b),
    configurations: [...configsSet].filter(Boolean),
    statuses: [...statusesSet],
  };
}

export async function recordUpload(
  projectId: string,
  fileName: string,
  totalRows: number,
  uploadedBy: string
): Promise<void> {
  const { error } = await supabase.from('uploads').insert({
    project_id: projectId,
    file_name: fileName,
    total_rows: totalRows,
    uploaded_by: uploadedBy,
  });
  if (error) throw error;
}
