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
        permission: 'EDITOR'
      },
      {
        userId: 'usr_pedro',
        username: 'pedro',
        nombreCompleto: 'Ing. Pedro Quispe',
        color: '#10b981',
        permission: 'VIEWER'
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
        permission: 'VIEWER'
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
        permission: 'EDITOR'
      },
      {
        userId: 'usr_pedro',
        username: 'pedro',
        nombreCompleto: 'Ing. Pedro Quispe',
        color: '#10b981',
        permission: 'VIEWER'
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
        permission: 'EDITOR'
      },
      {
        userId: 'usr_laura',
        username: 'laura',
        nombreCompleto: 'Dra. Laura Paredes',
        color: '#f97316',
        permission: 'EDITOR'
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

  constructor() {
    this.initProjects();
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
            // Si el catálogo tiene nombre genérico o difiere del diagrama editado por el usuario
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

    if (hasChanges || !localStorage.getItem(PROJECTS_STORAGE_KEY)) {
      this.persistProjects(stored);
    }
    this.projects.set(stored);
  }

  private persistProjects(list: ProjectSummary[]): void {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error(e);
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
    this.selectProject(newProj.id);
    return newProj;
  }

  /**
   * Determina el permiso del usuario actual para un proyecto específico
   */
  getUserPermission(projectId: string, userId?: string): ProjectPermission {
    const targetUserId = userId || this.authService.currentUser()?.id;
    if (!targetUserId) return 'NONE';

    // Si es Administrador General, puede supervisar (VIEWER por defecto si no es Owner)
    const isGlobalAdmin = this.authService.currentUser()?.rol === 'ADMINISTRADOR';

    const project = this.projects().find(p => p.id === projectId);
    if (!project) return 'NONE';

    // Es el Propietario (Owner)
    if (project.ownerId === targetUserId) {
      return 'OWNER';
    }

    // Buscar en la lista explícita de colaboradores autorizados
    const colab = project.colaboradores.find(c => c.userId === targetUserId);
    if (colab) {
      return colab.permission;
    }

    // Si es Administrador, tiene acceso de auditoría/lectura de supervisión
    if (isGlobalAdmin) {
      return 'VIEWER';
    }

    // Cualquier otro usuario sin invitación tiene acceso NULO ('NONE')
    return 'NONE';
  }

  /**
   * Actualiza el permiso de un colaborador específico (Solo permitido para el Owner)
   */
  updateCollaboratorPermission(projectId: string, targetUserId: string, newPermission: ProjectPermission): boolean {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return false;

    const project = this.projects().find(p => p.id === projectId);
    if (!project) return false;

    // Solo el Owner puede delegar permisos
    if (project.ownerId !== currentUser.id && currentUser.rol !== 'ADMINISTRADOR') {
      return false;
    }

    const targetUser = this.authService.users().find(u => u.id === targetUserId);
    if (!targetUser) return false;

    let updatedColabs = [...project.colaboradores];
    const existingIdx = updatedColabs.findIndex(c => c.userId === targetUserId);

    if (newPermission === 'NONE') {
      // Remover o marcar como sin acceso
      if (existingIdx >= 0) {
        updatedColabs[existingIdx] = { ...updatedColabs[existingIdx], permission: 'NONE' };
      }
    } else {
      if (existingIdx >= 0) {
        updatedColabs[existingIdx] = { ...updatedColabs[existingIdx], permission: newPermission };
      } else {
        updatedColabs.push({
          userId: targetUser.id,
          username: targetUser.username,
          nombreCompleto: targetUser.nombreCompleto,
          color: targetUser.color,
          permission: newPermission
        });
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
    return true;
  }

  /**
   * Verifica si el usuario tiene permiso para descargar el código ZIP del backend.
   * Solo el Dueño (Owner) o colaboradores autorizados explícitamente pueden descargar.
   */
  canUserDownloadBackend(projectId: string, userId?: string): boolean {
    const currentUserId = userId || this.authService.currentUser()?.id;
    if (!currentUserId) return false;

    const project = this.projects().find(p => p.id === projectId);
    if (!project) return false;

    // 1. El Propietario siempre tiene autorización total
    if (project.ownerId === currentUserId) {
      return true;
    }

    // 2. Colaborador con potestad de descarga delegada por el Dueño
    const colab = project.colaboradores.find(c => c.userId === currentUserId);
    return !!(colab && colab.canDownloadBackend && colab.permission !== 'NONE');
  }

  /**
   * Concede o revoca el permiso de descarga de backend a un colaborador (Solo Dueño)
   */
  toggleCollaboratorDownload(projectId: string, targetUserId: string): boolean {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return false;

    const project = this.projects().find(p => p.id === projectId);
    if (!project) return false;

    // Solo el Dueño del diagrama puede otorgar o revocar permiso de descarga
    if (project.ownerId !== currentUser.id && currentUser.rol !== 'ADMINISTRADOR') {
      return false;
    }

    const updatedColabs = project.colaboradores.map(c => {
      if (c.userId === targetUserId) {
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
  }

  /**
   * Genera el enlace de invitación para compartir
   */
  getShareableLink(projectId: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200';
    return `${origin}/?project=${projectId}`;
  }
}
