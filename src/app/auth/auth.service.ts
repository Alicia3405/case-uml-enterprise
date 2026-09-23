import { Injectable, inject, signal } from '@angular/core';
import { AutenticacinService } from '../api/api/autenticacin.service';
import { map, Observable, tap } from 'rxjs';

export interface UserContext {
  username: string;
  nombreCompleto?: string;
  rol: 'SOLICITANTE' | 'REVISOR' | 'ADMINISTRADOR';
  departamento: string;
  token?: string;
  avatarUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authApi = inject(AutenticacinService);

  currentUser = signal<UserContext | null>(null);

  constructor() {
    const saved = localStorage.getItem('WORKFLOW_SYS_USER');
    if (saved) {
      try {
        this.currentUser.set(JSON.parse(saved));
      } catch {
        localStorage.removeItem('WORKFLOW_SYS_USER');
      }
    }
    if (!this.currentUser()) {
      const defaultUser: UserContext = {
        username: 'arquitecto',
        nombreCompleto: 'Ingeniero de Software (UML)',
        rol: 'ADMINISTRADOR',
        departamento: 'Ingeniería de Software'
      };
      this.currentUser.set(defaultUser);
      localStorage.setItem('WORKFLOW_SYS_USER', JSON.stringify(defaultUser));
    }
  }

  login(credentials: { username: string, password: string }): Observable<UserContext> {
    const username = (credentials.username || '').trim();
    const password = (credentials.password || '').trim();

    if (!username || !password) {
      throw new Error('Usuario y contraseña son obligatorios');
    }

    return this.authApi.login({ username, password }).pipe(
      map((response) => {
        if (!response.exito || !response.datos) {
          throw new Error(response.mensaje || 'Respuesta de login inválida');
        }

        const payload = response.datos;
        const ctx: UserContext = {
          username: payload.username || username,
          nombreCompleto: payload.nombreCompleto || '',
          rol: (payload.rol as UserContext['rol']) || 'SOLICITANTE',
          departamento: payload.departamento || 'Sin Departamento',
          token: payload.token || '',
          avatarUrl: (payload as any).avatarUrl || ''
        };

        return ctx;
      }),
      tap((ctx) => {
        this.currentUser.set(ctx);
        localStorage.setItem('WORKFLOW_SYS_USER', JSON.stringify(ctx));
      })
    );
  }

  logout() {
    this.currentUser.set(null);
    localStorage.removeItem('WORKFLOW_SYS_USER');
  }

  /** Call this after admin updates their own avatar to keep the session in sync */
  updateCurrentUser(patch: Partial<Pick<UserContext, 'avatarUrl' | 'nombreCompleto'>>) {
    const current = this.currentUser();
    if (!current) return;
    const updated: UserContext = { ...current, ...patch };
    this.currentUser.set(updated);
    localStorage.setItem('WORKFLOW_SYS_USER', JSON.stringify(updated));
  }

  changePassword(currentPass: string, newPass: string): { success: boolean; message: string } {
    const current = this.currentUser();
    if (!current) return { success: false, message: 'No hay usuario autenticado.' };

    const savedKey = `PWD_${current.username}`;
    const storedPass = localStorage.getItem(savedKey) || '123456';

    if (currentPass !== storedPass) {
      return { success: false, message: 'La contraseña actual no es correcta.' };
    }

    if (!newPass || newPass.trim().length < 4) {
      return { success: false, message: 'La nueva contraseña debe tener al menos 4 caracteres.' };
    }

    localStorage.setItem(savedKey, newPass);
    return { success: true, message: '¡Contraseña cambiada con éxito!' };
  }

  hasAnyRole(roles: Array<UserContext['rol']>): boolean {
    const current = this.currentUser();
    return !!current && roles.includes(current.rol);
  }

  isSolicitante(): boolean {
    return this.currentUser()?.rol === 'SOLICITANTE';
  }

  isRevisor(): boolean {
    return this.currentUser()?.rol === 'REVISOR';
  }

  isAdministrador(): boolean {
    return this.currentUser()?.rol === 'ADMINISTRADOR';
  }

  getValidAvatar(url: string | undefined | null): string {
    if (!url || typeof url !== 'string') return '/icons/default-avatar.png';
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed.toLowerCase().includes('randomuser') || trimmed.toLowerCase().includes('ui-avatars') || trimmed.toLowerCase().includes('dicebear')) {
      return '/icons/default-avatar.png';
    }
    return trimmed;
  }
}
