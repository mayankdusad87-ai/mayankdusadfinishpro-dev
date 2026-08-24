import { supabase } from '@/lib/supabase';
import type { ManagedProject } from '@/lib/project-store';
import type { UploadedActivity } from '@/lib/project-data-store';
import { saveProjectToSupabase, recordUpload } from '@/repositories/project-repo';
import {
  saveActivitiesToSupabase,
  mergeActivitiesToSupabase,
  computeMergeSummary,
} from '@/repositories/activity-repo';
import type { UploadMode, MergeSummary } from '@/repositories/activity-repo';

export type { UploadMode, MergeSummary } from '@/repositories/activity-repo';

/**
 * Preview what a re-upload will do without writing anything.
 */
export async function getUploadMergeSummary(
  projectId: string,
  activities: UploadedActivity[],
): Promise<MergeSummary> {
  return computeMergeSummary(projectId, activities);
}

export async function uploadTemplate(
  project: ManagedProject,
  activities: UploadedActivity[],
  fileName: string,
  totalRows: number,
  userId: string,
  /** Upload mode — defaults to smart_merge for re-uploads, delete_all for first upload */
  mode: UploadMode = 'delete_all',
): Promise<MergeSummary | void> {
  await supabase.auth.refreshSession();

  let summary: MergeSummary | undefined;
  if (mode === 'delete_all') {
    await saveActivitiesToSupabase(project.id, activities);
  } else {
    summary = await mergeActivitiesToSupabase(project.id, activities, mode);
  }

  await saveProjectToSupabase({ ...project, hasTemplate: true });
  await recordUpload(project.id, fileName, totalRows, userId);
  return summary;
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
