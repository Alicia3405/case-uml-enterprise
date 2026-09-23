import { Component, inject, signal, output, input, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthSessionService } from '../../services/auth-session.service';
import { ProjectWorkspaceService } from '../../services/project-workspace.service';
import { ProjectPermission, ProjectSummary, ProjectCollaborator } from '../../models/collaboration.models';

export interface DisplayMember {
  userId: string;
  username: string;
  nombreCompleto: string;
  color: string;
  permission: ProjectPermission;
  isOwner: boolean;
  status: 'ACTIVO' | 'PENDIENTE';
}

@Component({
  selector: 'app-project-collaborators-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-collaborators-modal.component.html'
})
export class ProjectCollaboratorsModalComponent implements OnInit {
  public authService = inject(AuthSessionService);
  public projectService = inject(ProjectWorkspaceService);

  projectId = input.required<string>();
  closed = output<void>();

  copiedToast = signal<boolean>(false);
  project = signal<ProjectSummary | null>(null);

  // Formulario simple de invitación (1 solo campo de búsqueda + selector de rol)
  inviteQuery = signal<string>('');
  inviteRole = signal<'EDITOR' | 'VIEWER'>('EDITOR');
  inviteFeedback = signal<string | null>(null);

  ngOnInit(): void {
    this.refreshProject();
  }

  refreshProject(): void {
    const p = this.projectService.projects().find(x => x.id === this.projectId());
    if (p) {
      this.project.set(p);
    }
  }

  // Lista que muestra ÚNICAMENTE a los colaboradores de este proyecto (Propietario + Miembros asignados)
  members = computed<DisplayMember[]>(() => {
    const p = this.project();
    if (!p) return [];

    const list: DisplayMember[] = [];

    // 1. Dueño del proyecto
    const ownerUser = this.authService.users().find(u => u.id === p.ownerId);
    list.push({
      userId: p.ownerId,
      username: ownerUser?.username || 'owner',
      nombreCompleto: p.ownerName || ownerUser?.nombreCompleto || 'Propietario',
      color: ownerUser?.color || '#f59e0b',
      permission: 'OWNER',
      isOwner: true,
      status: 'ACTIVO'
    });

    // 2. Colaboradores con rol activo en este proyecto
    p.colaboradores
      .filter(c => c.permission !== 'NONE')
      .forEach(c => {
        const u = this.authService.users().find(user => user.id === c.userId);
        list.push({
          userId: c.userId,
          username: c.username || u?.username || 'usuario',
          nombreCompleto: c.nombreCompleto || u?.nombreCompleto || c.username,
          color: c.color || u?.color || '#38bdf8',
          permission: c.permission,
          isOwner: false,
          status: 'ACTIVO'
        });
      });

    return list;
  });

  get shareableLink(): string {
    return this.projectService.getShareableLink(this.projectId());
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareableLink);
    this.copiedToast.set(true);
    setTimeout(() => this.copiedToast.set(false), 2500);
  }

  // Invitar con un único campo rápido (Nombre o Usuario)
  inviteCollaborator(): void {
    const query = this.inviteQuery().trim();
    if (!query) return;

    const p = this.project();
    if (!p) return;

    // Buscar si ya existe entre los usuarios del sistema por username o nombre
    const normalizedQuery = query.toLowerCase();
    let targetUser = this.authService.users().find(u => 
      u.username.toLowerCase() === normalizedQuery ||
      u.nombreCompleto.toLowerCase().includes(normalizedQuery)
    );

    let targetUserId: string;

    // Si no está registrado en el catálogo de usuarios, lo creamos dinámicamente
    if (!targetUser) {
      targetUserId = 'usr_' + Date.now().toString().slice(-6);
      const randomColor = ['#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f97316'][Math.floor(Math.random() * 5)];
      const newUser = {
        id: targetUserId,
        username: query.toLowerCase().replace(/\s+/g, '_'),
        nombreCompleto: query,
        rol: 'USUARIO' as const,
        departamento: 'Ingeniería de Software',
        color: randomColor,
        debeCambiarPassword: false,
        fechaCreacion: new Date().toISOString()
      };
      this.authService.users.update(list => [...list, newUser]);
      targetUser = newUser;
    } else {
      targetUserId = targetUser.id;
    }

    // Verificar si ya es el dueño
    if (targetUserId === p.ownerId) {
      this.inviteFeedback.set('⚠️ Este usuario ya es el Propietario del proyecto.');
      setTimeout(() => this.inviteFeedback.set(null), 3500);
      return;
    }

    // Delegar permiso en el proyecto
    this.projectService.updateCollaboratorPermission(p.id, targetUserId, this.inviteRole());
    this.refreshProject();

    this.inviteQuery.set('');
    this.inviteFeedback.set(`✅ Invitación asignada a "${targetUser.nombreCompleto}" con rol ${this.inviteRole() === 'EDITOR' ? 'Editor' : 'Lector'}.`);
    setTimeout(() => this.inviteFeedback.set(null), 3500);
  }

  // Modificar rol dinámicamente (Editor <-> Lector)
  changeRole(userId: string, newRole: ProjectPermission): void {
    const p = this.project();
    if (!p || newRole === 'OWNER') return;

    this.projectService.updateCollaboratorPermission(p.id, userId, newRole);
    this.refreshProject();
  }

  // Revocar acceso / Eliminar colaborador
  removeMember(userId: string): void {
    const p = this.project();
    if (!p) return;

    this.projectService.updateCollaboratorPermission(p.id, userId, 'NONE');
    this.refreshProject();
  }
}

