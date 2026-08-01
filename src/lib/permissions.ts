export type Role = 'admin' | 'management' | 'supervisor';
export type Device = 'desktop' | 'mobile';
export type AccessLevel = 'full' | 'view' | 'restricted' | 'none';

export type Feature =
  | 'upload-template'
  | 'manage-projects'
  | 'manage-supervisors'
  | 'manage-management'
  | 'dashboard'
  | 'activity-log'
  | 'error-log'
  | 'photo-review'
  | 'insights-view'
  | 'export-download'
  | 'settings'
  | 'activity-updates'
  | 'photo-upload'
  | 'bulk-status-update';

type PermissionMatrix = Record<Role, Record<Device, Record<Feature, AccessLevel>>>;

export const PERMISSIONS: PermissionMatrix = {
  admin: {
    desktop: {
      'upload-template': 'full',
      'manage-projects': 'full',
      'manage-supervisors': 'full',
      'manage-management': 'full',
      dashboard: 'full',
      'activity-log': 'full',
      'error-log': 'full',
      'photo-review': 'full',
      'insights-view': 'full',
      'export-download': 'full',
      settings: 'full',
      'activity-updates': 'none',
      'photo-upload': 'none',
      'bulk-status-update': 'none',
    },
    mobile: {
      'upload-template': 'none',
      'manage-projects': 'full',
      'manage-supervisors': 'full',
      'manage-management': 'full',
      dashboard: 'full',
      'activity-log': 'view',
      'error-log': 'view',
      'photo-review': 'view',
      'insights-view': 'full',
      'export-download': 'none',
      settings: 'none',
      'activity-updates': 'none',
      'photo-upload': 'none',
      'bulk-status-update': 'none',
    },
  },
  management: {
    desktop: {
      'upload-template': 'none',
      'manage-projects': 'view',
      'manage-supervisors': 'none',
      'manage-management': 'none',
      dashboard: 'view',
      'activity-log': 'view',
      'error-log': 'none',
      'photo-review': 'view',
      'insights-view': 'full',
      'export-download': 'full',
      settings: 'none',
      'activity-updates': 'none',
      'photo-upload': 'none',
      'bulk-status-update': 'none',
    },
    mobile: {
      'upload-template': 'none',
      'manage-projects': 'view',
      'manage-supervisors': 'none',
      'manage-management': 'none',
      dashboard: 'view',
      'activity-log': 'view',
      'error-log': 'none',
      'photo-review': 'view',
      'insights-view': 'full',
      'export-download': 'none',
      settings: 'none',
      'activity-updates': 'none',
      'photo-upload': 'none',
      'bulk-status-update': 'none',
    },
  },
  supervisor: {
    desktop: {
      'upload-template': 'none',
      'manage-projects': 'none',
      'manage-supervisors': 'none',
      'manage-management': 'none',
      dashboard: 'none',
      'activity-log': 'none',
      'error-log': 'none',
      'photo-review': 'none',
      'insights-view': 'none',
      'export-download': 'none',
      settings: 'none',
      'activity-updates': 'full',
      'photo-upload': 'full',
      'bulk-status-update': 'full',
    },
    mobile: {
      'upload-template': 'none',
      'manage-projects': 'none',
      'manage-supervisors': 'none',
      'manage-management': 'none',
      dashboard: 'none',
      'activity-log': 'none',
      'error-log': 'none',
      'photo-review': 'none',
      'insights-view': 'none',
      'export-download': 'none',
      settings: 'none',
      'activity-updates': 'full',
      'photo-upload': 'full',
      'bulk-status-update': 'restricted',
    },
  },
};

export function getAccess(role: Role, device: Device, feature: Feature): AccessLevel {
  return PERMISSIONS[role]?.[device]?.[feature] ?? 'none';
}

export function canAccess(role: Role, device: Device, feature: Feature): boolean {
  return getAccess(role, device, feature) !== 'none';
}

export function canEdit(role: Role, device: Device, feature: Feature): boolean {
  return getAccess(role, device, feature) === 'full';
}
