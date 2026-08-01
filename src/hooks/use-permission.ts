import { useAuth } from '@/lib/auth-context';
import { useDevice } from './use-device';
import { getAccess, canAccess, canEdit, type Feature, type AccessLevel, type Role, type Device } from '@/lib/permissions';

export function usePermission(feature: Feature): AccessLevel {
  const { profile } = useAuth();
  const device = useDevice();
  const role = (profile?.role ?? 'supervisor') as Role;
  return getAccess(role, device, feature);
}

export function useCanAccess(feature: Feature): boolean {
  const { profile } = useAuth();
  const device = useDevice();
  const role = (profile?.role ?? 'supervisor') as Role;
  return canAccess(role, device, feature);
}

export function useCanEdit(feature: Feature): boolean {
  const { profile } = useAuth();
  const device = useDevice();
  const role = (profile?.role ?? 'supervisor') as Role;
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
