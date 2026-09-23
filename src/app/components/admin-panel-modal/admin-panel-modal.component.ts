import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthSessionService } from '../../services/auth-session.service';
import { ProjectWorkspaceService } from '../../services/project-workspace.service';
import { AppUser, ProjectSummary } from '../../models/collaboration.models';

@Component({
  selector: 'app-admin-panel-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-panel-modal.component.html'
})
export class AdminPanelModalComponent {
  public authService = inject(AuthSessionService);
  public projectService = inject(ProjectWorkspaceService);

  closed = output<void>();
  projectSelected = output<string>();

  activeTab = signal<'USERS' | 'PROJECTS'>('USERS');

  // Formulario nuevo usuario
  newUsername = '';
  newFullName = '';
  initialPassword = 'empresa2026';
  userSuccessMsg = signal<string>('');
  userErrorMsg = signal<string>('');

  // Filtro de proyectos por usuario
  selectedUserFilter = signal<string>('ALL');

  get filteredProjects(): ProjectSummary[] {
    const filter = this.selectedUserFilter();
    if (filter === 'ALL') {
      return this.projectService.projects();
    }
    return this.projectService.projects().filter(p => p.ownerId === filter);
  }

  createNewUser(): void {
    this.userSuccessMsg.set('');
    this.userErrorMsg.set('');

    const res = this.authService.createUser({
      username: this.newUsername,
      nombreCompleto: this.newFullName,
      password: this.initialPassword
    });

    if (res.success) {
      this.userSuccessMsg.set(`Usuario "${this.newFullName}" creado exitosamente con contraseña temporal.`);
      this.newUsername = '';
      this.newFullName = '';
    } else {
      this.userErrorMsg.set(res.message);
    }
  }

  inspectProject(projId: string): void {
    this.projectSelected.emit(projId);
    this.closed.emit();
  }
}
