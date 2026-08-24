export {
  logAppError,
  friendlyError,
  getAppErrors,
} from '@/repositories/errors';
export type { AppError } from '@/repositories/errors';

export {
  getProjectsFromSupabase,
  getProjectFromSupabase,
  saveProjectToSupabase,
  deleteProjectFromSupabase,
  getProjectFloors,
  getRefugeConfig,
  saveRefugeConfig,
  getProjectDataFromSupabase,
  getSupervisorProjectData,
  recordUpload,
} from '@/repositories/project-repo';

export {
  getActivitiesFromSupabase,
  saveActivitiesToSupabase,
  mergeActivitiesToSupabase,
  computeMergeSummary,
  updateActivityInSupabase,
  getActivitiesPage,
  getCriticalDelays,
  getAllFilteredActivities,
  updateActivityWithAudit,
  bulkUpdateActivities,
  getPhotoCount,
  getAdminEmails,
  getDashboardData,
  getInsightActivities,
} from '@/repositories/activity-repo';
export type { ActivitiesPage, SubstageRollup, DashboardData, InsightRow, UploadMode, MergeSummary } from '@/repositories/activity-repo';

export {
  uploadActivityPhoto,
  getPhotosForActivity,
  getPhotosForProject,
  deleteActivityPhoto,
} from '@/repositories/photo-repo';
export type { ActivityPhoto } from '@/repositories/photo-repo';

export {
  createSupervisor,
  resetUserPassword,
  deactivateSupervisor,
  getSupervisors,
  getSupervisorAssignments,
  assignSupervisorToProject,
} from '@/repositories/supervisor-repo';

export {
  createManagementUser,
  getManagementUsers,
  toggleManagementUserStatus,
} from '@/repositories/management-repo';
export type { ManagementUser } from '@/repositories/management-repo';

export {
  createFinishingTeamUser,
  getFinishingTeamUsers,
  toggleFinishingTeamUserStatus,
} from '@/repositories/finishing-team-repo';
export type { FinishingTeamUser } from '@/repositories/finishing-team-repo';

export {
  getReasons,
  getActiveReasons,
  createReason,
  updateReason,
  deleteReason,
} from '@/repositories/reason-repo';
export type { Reason } from '@/repositories/reason-repo';

export { getAuditLog } from '@/repositories/audit-repo';
export type { AuditLogRow } from '@/repositories/audit-repo';
