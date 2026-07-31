export { logAppError, friendlyError, getAppErrors } from './errors';
export type { AppError } from './errors';

export {
  getProjectsFromSupabase,
  getProjectFromSupabase,
  saveProjectToSupabase,
  deleteProjectFromSupabase,
  getProjectFloors,
  getRefugeConfig,
  saveRefugeConfig,
  getProjectDataFromSupabase,
  recordUpload,
} from './project-repo';

export {
  getActivitiesFromSupabase,
  saveActivitiesToSupabase,
  updateActivityInSupabase,
  getActivitiesPage,
  getCriticalDelays,
  getAllFilteredActivities,
  updateActivityWithAudit,
  bulkUpdateActivities,
  getPhotoCount,
  getAdminEmails,
  getDashboardData,
} from './activity-repo';
export type { ActivitiesPage, SubstageRollup, DashboardData } from './activity-repo';

export {
  uploadActivityPhoto,
  getPhotosForActivity,
  getPhotosForProject,
  deleteActivityPhoto,
} from './photo-repo';
export type { ActivityPhoto } from './photo-repo';

export {
  createSupervisor,
  resetUserPassword,
  deactivateSupervisor,
  getSupervisors,
  getSupervisorAssignments,
  assignSupervisorToProject,
} from './supervisor-repo';

export {
  getReasons,
  getActiveReasons,
  createReason,
  updateReason,
  deleteReason,
} from './reason-repo';
export type { Reason } from './reason-repo';

export { getAuditLog } from './audit-repo';
export type { AuditLogRow } from './audit-repo';
