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
  getInsightActivities,
} from './activity-repo';
export type { ActivitiesPage, SubstageRollup, DashboardData, InsightRow } from './activity-repo';

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
  createFinishingTeamUser,
  getFinishingTeamUsers,
  toggleFinishingTeamUserStatus,
} from './finishing-team-repo';
export type { FinishingTeamUser } from './finishing-team-repo';

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

export { getAssignmentHistory } from './assignment-history-repo';
export type { AssignmentHistoryEntry } from './assignment-history-repo';

export {
  getStageWeights,
  setStageWeights,
  getPaintDaysPerFlat,
  setPaintDaysPerFlat,
} from './settings-repo';

export {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from './notification-repo';
export type { NotificationsResult } from './notification-repo';

export {
  getFloorHandovers,
  upsertFloorHandover,
  bulkUpsertFloorHandovers,
} from './handover-repo';
export type { FloorHandover } from './handover-repo';
