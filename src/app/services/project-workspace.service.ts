import { Injectable, inject, signal } from '@angular/core';
import { AuthSessionService } from './auth-session.service';
import { ProjectSummary, ProjectPermission, ProjectCollaborator } from '../models/collaboration.models';

const PROJECTS_STORAGE_KEY = 'case_enterprise_projects';

const INITIAL_PROJECTS: ProjectSummary[] = [
  {
    id: 'proj_salud_2026',
    name: 'Sistema de Gestión de Salud Hospitalaria',
    description: 'Modelo conceptual de datos UML 2.5 para consultas, médicos y pacientes.',
    ownerId: 'usr_carlos',
    ownerName: 'Ing. Carlos Mendoza',
    colaboradores: [
      {
        userId: 'usr_laura',
        username: 'laura',
        nombreCompleto: 'Dra. Laura Paredes',
        color: '#f97316',
        permission: 'EDITOR',
        canDownloadBackend: true
      },
      {
        userId: 'usr_pedro',
        username: 'pedro',
        nombreCompleto: 'Ing. Pedro Quispe',
        color: '#10b981',
        permission: 'VIEWER',
        canDownloadBackend: false
      },
      {
        userId: 'usr_sofia',
        username: 'sofia',
        nombreCompleto: 'Sofía Rojas',
        color: '#ec4899',
        permission: 'EDITOR',
        canDownloadBackend: true
      }
    ],
    totalClases: 4,
    totalRelaciones: 3,
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'proj_ecommerce_2026',
    name: 'Plataforma de Facturación y Pedidos',
    description: 'Diagrama de clases para el módulo de pagos y comprobantes fiscales.',
    ownerId: 'usr_carlos',
    ownerName: 'Ing. Carlos Mendoza',
    colaboradores: [
      {
        userId: 'usr_laura',
        username: 'laura',
        nombreCompleto: 'Dra. Laura Paredes',
        color: '#f97316',
        permission: 'VIEWER',
        canDownloadBackend: false
      },
      {
        userId: 'usr_sofia',
        username: 'sofia',
        nombreCompleto: 'Sofía Rojas',
        color: '#ec4899',
        permission: 'EDITOR',
        canDownloadBackend: true
      }
    ],
    totalClases: 5,
    totalRelaciones: 4,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'proj_laboratorio_2026',
    name: 'Gestión de Laboratorio Clínico y Muestras',
    description: 'Modelo de entidades UML para análisis de sangre, reactivos y resultados.',
    ownerId: 'usr_laura',
    ownerName: 'Dra. Laura Paredes',
    colaboradores: [
      {
        userId: 'usr_carlos',
        username: 'carlos',
        nombreCompleto: 'Ing. Carlos Mendoza',
        color: '#0ea5e9',
        permission: 'EDITOR',
        canDownloadBackend: true
      },
      {
        userId: 'usr_pedro',
        username: 'pedro',
        nombreCompleto: 'Ing. Pedro Quispe',
        color: '#10b981',
        permission: 'VIEWER',
        canDownloadBackend: false
      },
      {
        userId: 'usr_sofia',
        username: 'sofia',
        nombreCompleto: 'Sofía Rojas',
        color: '#ec4899',
        permission: 'EDITOR',
        canDownloadBackend: true
      }
    ],
    totalClases: 3,
    totalRelaciones: 2,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'proj_farmacia_2026',
    name: 'Inventario y Dispensación Farmacéutica',
    description: 'Control de stocks de medicamentos, lotes y prescripciones médicas.',
    ownerId: 'usr_pedro',
    ownerName: 'Ing. Pedro Quispe',
    colaboradores: [
      {
        userId: 'usr_carlos',
        username: 'carlos',
        nombreCompleto: 'Ing. Carlos Mendoza',
        color: '#0ea5e9',
        permission: 'EDITOR',
        canDownloadBackend: true
      },
      {
        userId: 'usr_laura',
        username: 'laura',
        nombreCompleto: 'Dra. Laura Paredes',
        color: '#f97316',
        permission: 'EDITOR',
        canDownloadBackend: true
      },
      {
        userId: 'usr_sofia',
        username: 'sofia',
        nombreCompleto: 'Sofía Rojas',
        color: '#ec4899',
        permission: 'EDITOR',
        canDownloadBackend: true
      }
    ],
    totalClases: 4,
    totalRelaciones: 3,
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

@Injectable({
  providedIn: 'root'
})
export class ProjectWorkspaceService {
  private authService = inject(AuthSessionService);

  projects = signal<ProjectSummary[]>([]);
  activeProjectId = signal<string>('proj_salud_2026');
  private syncTimer: any = null;
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.initProjects();
    this.initBroadcastChannel();
    this.initStorageListener();
    this.startBackgroundSync();
  }

  private getBackendUrl(): string {
    if (typeof window === 'undefined') return 'http://localhost:8080';
    const host = window.location.hostname || 'localhost';
    return `${window.location.protocol}//${host}:8080`;
  }

  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('case_uml_collab_bus');
        this.channel.onmessage = (evt) => {
          if (evt.data?.type === 'PROJECTS_SYNCED' && Array.isArray(evt.data.projects)) {
            this.projects.set(evt.data.projects);
            this.persistProjects(evt.data.projects);
          }
        };
      } catch (e) {}
    }
  }

  private initStorageListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === PROJECTS_STORAGE_KEY && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) {
              this.projects.set(parsed);
            }
          } catch (err) {}
        }
      });
    }
  }

  private startBackgroundSync(): void {
    if (typeof window === 'undefined') return;
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      this.fetchProjectsFromBackend();
    }, 2000);
  }

  public fetchProjectsFromBackend(): void {
    if (typeof window === 'undefined') return;
    const url = `${this.getBackendUrl()}/api/v1/proyectos`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        const backendProjects: ProjectSummary[] = data?.datos || (Array.isArray(data) ? data : []);
        if (Array.isArray(backendProjects) && backendProjects.length > 0) {
          // Fusionar con proyectos locales
          const merged = [...backendProjects];
          for (const localP of this.projects()) {
            const idx = merged.findIndex(m => m.id === localP.id);
            if (idx === -1) {
              merged.push(localP);
            } else {
              // Fusionar colaboradores de backend y local
              const colabMap = new Map();
              for (const c of (merged[idx].colaboradores || [])) {
                const key = (c.userId || c.username || '').toLowerCase();
                if (key) colabMap.set(key, c);
              }
              for (const c of (localP.colaboradores || [])) {
                const key = (c.userId || c.username || '').toLowerCase();
                if (key) colabMap.set(key, c);
              }
              merged[idx].colaboradores = Array.from(colabMap.values());
            }
          }
          this.projects.set(merged);
          this.persistProjects(merged);
        }
      })
      .catch(() => {});
  }

  private initProjects(): void {
    let stored: ProjectSummary[] = [];
    try {
      const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }

    if (!stored || stored.length === 0) {
      stored = [...INITIAL_PROJECTS];
    } else {
      // Asegurar que existan los proyectos iniciales si no están
      for (const initP of INITIAL_PROJECTS) {
        if (!stored.some(p => p.id === initP.id)) {
          stored.push(initP);
        }
      }
    }

    // Sincronización automática de nombres reales, clases y relaciones desde los diagramas en memoria
    let hasChanges = false;
    stored = stored.map(p => {
      try {
        const rawDiag = localStorage.getItem('case_diagram_' + p.id);
        if (rawDiag) {
          const diag = JSON.parse(rawDiag);
          let updatedName = p.name;
          if (diag.name && typeof diag.name === 'string' && diag.name.trim()) {
            const cleanDiagName = diag.name.trim();
            if (p.name === 'Proyecto' || p.name === 'Nuevo Proyecto UML' || cleanDiagName !== p.name) {
              updatedName = cleanDiagName;
              hasChanges = true;
            }
          }
          const totalClases = Array.isArray(diag.classes) ? diag.classes.length : p.totalClases;
          const totalRelaciones = Array.isArray(diag.relations) ? diag.relations.length : p.totalRelaciones;
          if (totalClases !== p.totalClases || totalRelaciones !== p.totalRelaciones || updatedName !== p.name) {
            hasChanges = true;
            return {
              ...p,
              name: updatedName,
              totalClases,
              totalRelaciones
            };
          }
        }
      } catch (e) {}
      return p;
    });

    this.persistProjects(stored);
    this.projects.set(stored);
    this.fetchProjectsFromBackend();
  }

  private persistProjects(list: ProjectSummary[]): void {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  }

  private pushProjectsToBackend(list: ProjectSummary[]): void {
    if (typeof window === 'undefined') return;
    fetch(`${this.getBackendUrl()}/api/v1/proyectos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list)
    }).catch(() => {});
  }

  private broadcastProjects(list: ProjectSummary[]): void {
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'PROJECTS_SYNCED', projects: list });
      } catch (e) {}
    }
  }

  getActiveProject(): ProjectSummary | undefined {
    return this.projects().find(p => p.id === this.activeProjectId());
  }

  activeProject(): ProjectSummary | undefined {
    return this.getActiveProject();
  }

  selectProject(projectId: string): void {
    const exists = this.projects().some(p => p.id === projectId);
    if (exists) {
      this.activeProjectId.set(projectId);
    }
  }

  createProject(name: string, description: string): ProjectSummary {
    const user = this.authService.currentUser();
    const newProj: ProjectSummary = {
      id: 'proj_' + Date.now(),
      name: name.trim() || 'Nuevo Proyecto UML',
      description: description.trim() || 'Modelo de clases UML 2.5 colaborativo',
      ownerId: user?.id || 'usr_carlos',
      ownerName: user?.nombreCompleto || 'Propietario',
      colaboradores: [],
      totalClases: 0,
      totalRelaciones: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updated = [newProj, ...this.projects()];
    this.projects.set(updated);
    this.persistProjects(updated);
    this.pushProjectsToBackend(updated);
    this.broadcastProjects(updated);
    this.selectProject(newProj.id);
    return newProj;
  }

  /**
   * Determina el permiso del usuario actual para un proyecto específico
   */
  getUserPermission(projectId: string, userId?: string): ProjectPermission {
    const currentAuthUser = this.authService.currentUser();
    const allUsers = this.authService.users();

    let targetUserId = '';
    let targetUsername = '';

    if (userId) {
      const uSearch = userId.toLowerCase().trim();
      const targetUserObj = allUsers.find(u => 
        u.id.toLowerCase() === uSearch || 
        u.username.toLowerCase() === uSearch || 
        ('usr_' + u.username.toLowerCase()) === uSearch ||
        (u.id.toLowerCase() === ('usr_' + uSearch))
      );
      if (targetUserObj) {
        targetUserId = targetUserObj.id.toLowerCase();
        targetUsername = targetUserObj.username.toLowerCase();
      } else {
        targetUserId = uSearch;
        targetUsername = uSearch.replace(/^usr_/, '');
      }
    } else {
      targetUserId = (currentAuthUser?.id || '').toLowerCase().trim();
      targetUsername = (currentAuthUser?.username || '').toLowerCase().trim();
    }

    if (!targetUserId && !targetUsername) return 'NONE';

    const project = this.projects().find(p => p.id === projectId);
    if (!project) return 'NONE';

    const owner = (project.ownerId || '').toLowerCase().trim();
    const isOwner = owner === targetUserId ||
                    owner === targetUsername ||
                    owner === ('usr_' + targetUsername) ||
                    ('usr_' + owner) === targetUserId ||
                    ('usr_' + owner) === ('usr_' + targetUsername);
    if (isOwner) {
      return 'OWNER';
    }

    // Buscar en la lista explícita de colaboradores autorizados
    if (project.colaboradores && Array.isArray(project.colaboradores)) {
      const colab = project.colaboradores.find(c => {
        const cId = (c.userId || '').toLowerCase().trim();
        const cUsername = (c.username || '').toLowerCase().trim();
        return cId === targetUserId ||
               cId === targetUsername ||
               cId === ('usr_' + targetUsername) ||
               ('usr_' + cId) === targetUserId ||
               ('usr_' + cId) === ('usr_' + targetUsername) ||
               cUsername === targetUsername ||
               cUsername === targetUserId ||
               ('usr_' + cUsername) === targetUserId ||
               ('usr_' + cUsername) === ('usr_' + targetUsername);
      });
      if (colab && colab.permission) {
        return colab.permission;
      }
    }

    // Si es Administrador y está consultando su propio permiso
    if (!userId && currentAuthUser?.rol === 'ADMINISTRADOR') {
      return 'VIEWER';
    }

    return 'NONE';
  }

  /**
   * Actualiza o asigna de forma directa e inmediata el permiso de un colaborador
   */
  updateCollaboratorPermission(projectId: string, targetUserId: string, newPermission: ProjectPermission): boolean {
    const project = this.projects().find(p => p.id === projectId);
    if (!project) return false;

    // Buscar el usuario en el directorio
    const allUsers = this.authService.users();
    const targetUser = allUsers.find(u => 
      u.id.toLowerCase() === targetUserId.toLowerCase() ||
      u.username.toLowerCase() === targetUserId.toLowerCase() ||
      u.id.toLowerCase() === ('usr_' + targetUserId.toLowerCase())
    );

    const effId = targetUser ? targetUser.id : (targetUserId.startsWith('usr_') ? targetUserId : 'usr_' + targetUserId);
    const effUsername = targetUser ? targetUser.username : targetUserId.replace(/^usr_/, '');
    const effName = targetUser ? targetUser.nombreCompleto : effUsername;
    const effColor = targetUser ? targetUser.color : '#0ea5e9';

    let updatedColabs = [...(project.colaboradores || [])];
    
    // Buscar si ya existía
    const existingIdx = updatedColabs.findIndex(c => 
      c.userId?.toLowerCase() === effId.toLowerCase() ||
      c.username?.toLowerCase() === effUsername.toLowerCase() ||
      c.userId?.toLowerCase() === targetUserId.toLowerCase() ||
      c.username?.toLowerCase() === targetUserId.toLowerCase()
    );

    if (newPermission === 'NONE') {
      if (existingIdx >= 0) {
        updatedColabs.splice(existingIdx, 1);
      }
    } else {
      const colabObj: ProjectCollaborator = {
        userId: effId,
        username: effUsername,
        nombreCompleto: effName,
        color: effColor,
        permission: newPermission,
        canDownloadBackend: true
      };

      if (existingIdx >= 0) {
        updatedColabs[existingIdx] = { ...updatedColabs[existingIdx], ...colabObj };
      } else {
        updatedColabs.push(colabObj);
      }
    }

    const updatedProjects = this.projects().map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          colaboradores: updatedColabs,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    this.projects.set(updatedProjects);
    this.persistProjects(updatedProjects);
    this.pushProjectsToBackend(updatedProjects);
    
    // Notificación directa de colaborador al backend REST
    if (typeof window !== 'undefined') {
      fetch(`${this.getBackendUrl()}/api/v1/proyectos/colaborador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          collaborator: {
            userId: effId,
            username: effUsername,
            nombreCompleto: effName,
            color: effColor,
            permission: newPermission,
            canDownloadBackend: true
          }
        })
      }).catch(() => {});
    }

    this.broadcastProjects(updatedProjects);
    return true;
  }

  /**
   * Verifica si el usuario tiene permiso para descargar el código ZIP del backend.
   */
  canUserDownloadBackend(projectId: string, userId?: string): boolean {
    const user = this.authService.currentUser();
    const currentUserId = (userId || user?.id || '').toLowerCase();
    const currentUsername = (user?.username || '').toLowerCase();
    if (!currentUserId && !currentUsername) return false;

    const project = this.projects().find(p => p.id === projectId);
    if (!project) return false;

    // 1. El Propietario siempre tiene autorización total
    const owner = (project.ownerId || '').toLowerCase();
    if (owner === currentUserId || owner === currentUsername || owner === ('usr_' + currentUsername)) {
      return true;
    }

    // 2. Colaborador con potestad de descarga
    if (project.colaboradores && Array.isArray(project.colaboradores)) {
      const colab = project.colaboradores.find(c => {
        const cId = (c.userId || '').toLowerCase();
        const cUsername = (c.username || '').toLowerCase();
        return cId === currentUserId || cId === currentUsername || cUsername === currentUsername || cUsername === currentUserId;
      });
      return !!(colab && colab.canDownloadBackend && colab.permission !== 'NONE');
    }

    return false;
  }

  /**
   * Concede o revoca el permiso de descarga de backend a un colaborador
   */
  toggleCollaboratorDownload(projectId: string, targetUserId: string): boolean {
    const project = this.projects().find(p => p.id === projectId);
    if (!project) return false;

    const tId = targetUserId.toLowerCase();
    const updatedColabs = (project.colaboradores || []).map(c => {
      const cId = (c.userId || '').toLowerCase();
      const cUsername = (c.username || '').toLowerCase();
      if (cId === tId || cUsername === tId) {
        return {
          ...c,
          canDownloadBackend: !c.canDownloadBackend
        };
      }
      return c;
    });

    const updatedProjects = this.projects().map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          colaboradores: updatedColabs,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    this.projects.set(updatedProjects);
    this.persistProjects(updatedProjects);
    this.pushProjectsToBackend(updatedProjects);
    this.broadcastProjects(updatedProjects);
    return true;
  }

  /**
   * Actualiza el conteo de clases, relaciones y el nombre de un proyecto específico
   */
  updateProjectCounters(projectId: string, classesCount: number, relsCount: number, name?: string): void {
    const updated = this.projects().map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          name: name && name.trim() ? name.trim() : p.name,
          totalClases: classesCount,
          totalRelaciones: relsCount,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    this.projects.set(updated);
    this.persistProjects(updated);
    this.pushProjectsToBackend(updated);
    this.broadcastProjects(updated);
  }

  /**
   * Actualiza el nombre asignado al proyecto
   */
  updateProjectName(projectId: string, newName: string): void {
    const clean = (newName || '').trim();
    if (!clean) return;
    const updated = this.projects().map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          name: clean,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });
    this.projects.set(updated);
    this.persistProjects(updated);
    this.pushProjectsToBackend(updated);
    this.broadcastProjects(updated);
  }

  /**
   * Genera el enlace de invitación para compartir
   */
  getShareableLink(projectId: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200';
    return `${origin}/?project=${projectId}`;
  }
}
