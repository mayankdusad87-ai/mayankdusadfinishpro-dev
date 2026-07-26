'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getProjectsFromSupabase } from './supabase-data';
import { useAuth } from './auth-context';
import type { ManagedProject } from './project-store';

interface ProjectContextType {
  projects: ManagedProject[];
  currentProject: ManagedProject | null;
  setCurrentProjectId: (id: string) => void;
  refreshProjects: () => Promise<ManagedProject[]>;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  currentProject: null,
  setCurrentProjectId: () => {},
  refreshProjects: async () => [],
});

export function useProject() {
  return useContext(ProjectContext);
}

const SELECTED_KEY = 'finishing_pro_selected_project';

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const { user } = useAuth();

  const refreshProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      return [];
    }
    try {
      const list = await getProjectsFromSupabase();
      setProjects(list);
      return list;
    } catch {
      setProjects([]);
      return [];
    }
  }, [user]);

  useEffect(() => {
    refreshProjects().then(list => {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(SELECTED_KEY) : null;
      if (saved && list.find(p => p.id === saved)) {
        setCurrentId(saved);
      } else if (list.length > 0) {
        setCurrentId(list[0].id);
        localStorage.setItem(SELECTED_KEY, list[0].id);
      }
    });
  }, [refreshProjects]);

  function setCurrentProjectId(id: string) {
    setCurrentId(id);
    localStorage.setItem(SELECTED_KEY, id);
  }

  const currentProject = projects.find(p => p.id === currentId) || null;

  return (
    <ProjectContext.Provider value={{ projects, currentProject, setCurrentProjectId, refreshProjects }}>
      {children}
    </ProjectContext.Provider>
  );
}
