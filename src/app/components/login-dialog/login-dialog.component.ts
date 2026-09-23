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

  // Modo rápido de demostración
  demoUsers = [
    { username: 'carlos', pass: 'empresa2026', role: 'Owner / Diseñador', name: 'Carlos Mendoza', color: '#0ea5e9' },
    { username: 'laura', pass: 'empresa2026', role: 'Colaborador Editor', name: 'Laura Paredes', color: '#f97316' },
    { username: 'pedro', pass: 'empresa2026', role: 'Colaborador Lector', name: 'Pedro Quispe', color: '#10b981' },
    { username: 'admin', pass: 'admin', role: 'Jefe Administrador', name: 'Jefe General TI', color: '#8b5cf6' }
  ];

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
