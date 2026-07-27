export interface ManagedProject {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'completed' | 'on_hold';
  totalFloors: number;
  totalFlats: number;
  createdAt: string;
  hasTemplate: boolean;
}

export function generateProjectId(): string {
  return 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
