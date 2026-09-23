import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthSessionService } from '../../services/auth-session.service';
import { AppUser } from '../../models/collaboration.models';

@Component({
  selector: 'app-login-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-dialog.component.html'
})
export class LoginDialogComponent {
  public authService = inject(AuthSessionService);

  closed = output<void>();

  // Campos de formulario
  username = '';
  password = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  errorMessage = signal<string>('');
  successMessage = signal<string>('');

  // Lista dinámica de usuarios de la organización
  get demoUsersList() {
    return this.authService.users().map(u => ({
      username: u.username,
      pass: u.password,
      role: u.rol === 'ADMINISTRADOR' ? 'Jefe Administrador' : (u.username === 'carlos' ? 'Owner / Diseñador' : 'Ingeniero'),
      name: u.nombreCompleto,
      color: u.color
    }));
  }

  login(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    const res = this.authService.login(this.username, this.password);
    if (!res.success) {
      this.errorMessage.set(res.message);
    } else {
      this.successMessage.set(res.message);
      if (!res.user?.debeCambiarPassword) {
        setTimeout(() => this.closed.emit(), 600);
      }
    }
  }

  quickSwitch(demo: { username: string; pass: string }): void {
    this.username = demo.username;
    this.password = demo.pass;
    this.login();
  }

  saveNewPassword(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Las contraseñas nuevas no coinciden.');
      return;
    }

    const res = this.authService.changePassword(this.currentPassword, this.newPassword);
    if (!res.success) {
      this.errorMessage.set(res.message);
    } else {
      this.successMessage.set(res.message);
      setTimeout(() => {
        this.closed.emit();
      }, 900);
    }
  }

  logout(): void {
    this.authService.logout();
    this.username = '';
    this.password = '';
  }
}
