import { supabase } from '@/lib/supabase';
import type { ManagedProject } from '@/lib/project-store';
import type { UploadedActivity } from '@/lib/project-data-store';
import { saveProjectToSupabase, recordUpload } from '@/repositories/project-repo';
import { saveActivitiesToSupabase } from '@/repositories/activity-repo';

export async function uploadTemplate(
  project: ManagedProject,
  activities: UploadedActivity[],
  fileName: string,
  totalRows: number,
  userId: string,
): Promise<void> {
  await supabase.auth.refreshSession();
  await saveActivitiesToSupabase(project.id, activities);
  await saveProjectToSupabase({ ...project, hasTemplate: true });
  await recordUpload(project.id, fileName, totalRows, userId);
}

export async function clearTemplate(
  project: ManagedProject,
): Promise<void> {
  await saveActivitiesToSupabase(project.id, []);
  await saveProjectToSupabase({ ...project, hasTemplate: false });
}

export function countModifiedActivities(activities: UploadedActivity[]): number {
  return activities.filter(
    a => a.status !== 'not_started' || a.actual_start || a.actual_end
  ).length;
}
