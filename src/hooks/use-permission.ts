import { useAuth } from '@/lib/auth-context';
import { useDevice } from './use-device';
import { useManagementAccess } from '@/lib/management-access-context';
import { getAccess, canAccess, canEdit, type Feature, type AccessLevel, type Role, type Device } from '@/lib/permissions';

/**
 * Map of Feature → ManagementAccess key.
 * Only features listed here are toggleable; the rest stay at their static permission.
 */
const MGMT_FEATURE_KEY: Partial<Record<Feature, 'dashboard' | 'insights' | 'photos'>> = {
  dashboard: 'dashboard',
  'insights-view': 'insights',
  'photo-review': 'photos',
};

export function usePermission(feature: Feature): AccessLevel {
  const { profile } = useAuth();
  const device = useDevice();
  const { access } = useManagementAccess();
  const role = (profile?.role ?? 'supervisor') as Role;

  // Check dynamic management access override
  if (role === 'management') {
    const accessKey = MGMT_FEATURE_KEY[feature];
    if (accessKey && !access[accessKey]) return 'none';
  }

  return getAccess(role, device, feature);
}

export function useCanAccess(feature: Feature): boolean {
  const { profile } = useAuth();
  const device = useDevice();
  const { access } = useManagementAccess();
  const role = (profile?.role ?? 'supervisor') as Role;

  // Check dynamic management access override
  if (role === 'management') {
    const accessKey = MGMT_FEATURE_KEY[feature];
    if (accessKey && !access[accessKey]) return false;
  }

  return canAccess(role, device, feature);
}

export function useCanEdit(feature: Feature): boolean {
  const { profile } = useAuth();
  const device = useDevice();
  const { access } = useManagementAccess();
  const role = (profile?.role ?? 'supervisor') as Role;

  // Check dynamic management access override
  if (role === 'management') {
    const accessKey = MGMT_FEATURE_KEY[feature];
    if (accessKey && !access[accessKey]) return false;
  }

  return canEdit(role, device, feature);
}

export function useRole(): Role {
  const { profile } = useAuth();
  return (profile?.role ?? 'supervisor') as Role;
}

export function useRoleDevice(): { role: Role; device: Device } {
  const { profile } = useAuth();
  const device = useDevice();
  return { role: (profile?.role ?? 'supervisor') as Role, device };
}
