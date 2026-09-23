import { Injectable, signal, computed } from '@angular/core';
import { AppUser, UserRole } from '../models/collaboration.models';

const USERS_STORAGE_KEY = 'case_enterprise_users';
const CURRENT_USER_KEY = 'case_current_user';

// Usuarios empresariales iniciales
const INITIAL_USERS: AppUser[] = [
  {
    id: 'usr_admin',
    username: 'admin',
    password: 'admin',
    nombreCompleto: 'Jefe General (Super Administrador)',
    rol: 'ADMINISTRADOR',
    color: '#8b5cf6',
    debeCambiarPassword: false,
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'usr_carlos',
    username: 'carlos',
    password: 'empresa2026',
    nombreCompleto: 'Carlos Mendoza',
    rol: 'USUARIO',
    color: '#0ea5e9',
    debeCambiarPassword: false,
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'usr_laura',
    username: 'laura',
    password: 'empresa2026',
    nombreCompleto: 'Laura Paredes',
    rol: 'USUARIO',
    color: '#f97316',
    debeCambiarPassword: false,
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'usr_pedro',
    username: 'pedro',
    password: 'empresa2026',
    nombreCompleto: 'Pedro Quispe',
    rol: 'USUARIO',
    color: '#10b981',
    debeCambiarPassword: false,
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'usr_sofia',
    username: 'sofia',
    password: 'empresa2026',
    nombreCompleto: 'Sofía Rojas',
    rol: 'USUARIO',
    color: '#ec4899',
    debeCambiarPassword: false,
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'usr_miguel',
    username: 'miguel',
    password: 'empresa2026',
    nombreCompleto: 'Miguel Fernández',
    rol: 'USUARIO',
    color: '#3b82f6',
    debeCambiarPassword: false,
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'usr_valeria',
    username: 'valeria',
    password: 'empresa2026',
    nombreCompleto: 'Valeria Castro',
    rol: 'USUARIO',
    color: '#a855f7',
    debeCambiarPassword: false,
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'usr_diego',
    username: 'diego',
    password: 'empresa2026',
    nombreCompleto: 'Diego Morales',
    rol: 'USUARIO',
    color: '#14b8a6',
    debeCambiarPassword: false,
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'usr_camila',
    username: 'camila',
    password: 'empresa2026',
    nombreCompleto: 'Camila Vargas',
    rol: 'USUARIO',
    color: '#f43f5e',
    debeCambiarPassword: false,
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'usr_fernando',
    username: 'fernando',
    password: 'empresa2026',
    nombreCompleto: 'Fernando Romero',
    rol: 'USUARIO',
    color: '#eab308',
    debeCambiarPassword: false,
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'usr_lucia',
    username: 'lucia',
    password: 'empresa2026',
    nombreCompleto: 'Lucía Gutiérrez',
    rol: 'USUARIO',
    color: '#6366f1',
    debeCambiarPassword: false,
    fechaCreacion: new Date().toISOString()
  }
];

@Injectable({
  providedIn: 'root'
})
export class AuthSessionService {
  // Catálogo reactivo de usuarios de la organización
  users = signal<AppUser[]>([]);

  // Usuario autenticado actual
  currentUser = signal<AppUser | null>(null);

  // Señales derivadas
  isLoggedIn = computed(() => !!this.currentUser());
  isAdmin = computed(() => this.currentUser()?.rol === 'ADMINISTRADOR');
  mustChangePassword = computed(() => !!this.currentUser()?.debeCambiarPassword);

  constructor() {
    this.initUsersAndSession();
  }

  private initUsersAndSession(): void {
    let storedUsers: AppUser[] = [];
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      if (raw) storedUsers = JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }

    if (!storedUsers || storedUsers.length === 0) {
      storedUsers = [...INITIAL_USERS];
      this.persistUsers(storedUsers);
    } else {
      // Deduplicar y asegurar que todos los usuarios iniciales estén presentes
      const seenUsernames = new Set<string>();
      const seenIds = new Set<string>();
      const cleaned: AppUser[] = [];
      for (const u of storedUsers) {
        const uName = (u.username || '').trim().toLowerCase();
        if (uName && !seenUsernames.has(uName) && !seenIds.has(u.id)) {
          seenUsernames.add(uName);
          seenIds.add(u.id);
          cleaned.push(u);
        }
      }
      for (const initU of INITIAL_USERS) {
        if (!cleaned.some(u => u.username.toLowerCase() === initU.username.toLowerCase())) {
          cleaned.push(initU);
        }
      }
      storedUsers = cleaned;
      this.persistUsers(storedUsers);
    }
    this.users.set(storedUsers);

    // Recuperar sesión activa o iniciar por defecto con Carlos (para pruebas fluidas)
    try {
      const activeRaw = localStorage.getItem(CURRENT_USER_KEY);
      if (activeRaw) {
        const parsed = JSON.parse(activeRaw);
        // Sincronizar con el estado actualizado en el catálogo
        const found = storedUsers.find(u => u.id === parsed.id) || parsed;
        this.currentUser.set(found);
      } else {
        this.currentUser.set(null);
      }
    } catch (e) {
      this.currentUser.set(null);
    }
  }

  private persistUsers(usersList: AppUser[]): void {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersList));
    } catch (e) {
      console.error('Error al guardar usuarios en storage:', e);
    }
  }

  login(username: string, password: string): { success: boolean; message: string; user?: AppUser } {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    const user = this.users().find(u => u.username.toLowerCase() === cleanUser);
    if (!user) {
      return { success: false, message: `El usuario "${username}" no existe en la organización.` };
    }

    if (user.password !== cleanPass) {
      return { success: false, message: 'Contraseña incorrecta.' };
    }

    this.currentUser.set(user);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return { success: true, message: `Bienvenido, ${user.nombreCompleto}.`, user };
  }

  changePassword(currentPass: string, newPass: string): { success: boolean; message: string } {
    const user = this.currentUser();
    if (!user) return { success: false, message: 'No hay una sesión activa.' };

    if (user.password !== currentPass.trim()) {
      return { success: false, message: 'La contraseña actual no coincide.' };
    }

    if (!newPass || newPass.trim().length < 4) {
      return { success: false, message: 'La nueva contraseña debe tener al menos 4 caracteres.' };
    }

    // Actualizar usuario
    const updatedUser: AppUser = {
      ...user,
      password: newPass.trim(),
      debeCambiarPassword: false
    };

    const updatedList = this.users().map(u => u.id === user.id ? updatedUser : u);
    this.users.set(updatedList);
    this.persistUsers(updatedList);

    this.currentUser.set(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));

    return { success: true, message: '¡Contraseña actualizada con éxito!' };
  }

  updateAvatar(avatarUrl: string): { success: boolean; message: string } {
    const user = this.currentUser();
    if (!user) return { success: false, message: 'No hay una sesión activa.' };

    const updatedUser: AppUser = {
      ...user,
      avatarUrl: avatarUrl.trim()
    };

    const updatedList = this.users().map(u => u.id === user.id ? updatedUser : u);
    this.users.set(updatedList);
    this.persistUsers(updatedList);

    this.currentUser.set(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));

    return { success: true, message: 'Foto de perfil guardada exitosamente.' };
  }

  createUser(payload: {
    username: string;
    nombreCompleto: string;
    password?: string;
  }): { success: boolean; message: string; user?: AppUser } {
    if (!this.isAdmin()) {
      return { success: false, message: 'Solo el Administrador puede dar de alta nuevos usuarios.' };
    }

    const cleanName = payload.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanName) {
      return { success: false, message: 'El nombre de usuario es inválido.' };
    }

    if (this.users().some(u => u.username.toLowerCase() === cleanName)) {
      return { success: false, message: `El usuario "${cleanName}" ya está registrado.` };
    }

    // Colores rotativos atractivos para avatares y candados
    const palette = ['#0ea5e9', '#f97316', '#10b981', '#ec4899', '#f59e0b', '#06b6d4', '#6366f1', '#a855f7'];
    const assignedColor = palette[this.users().length % palette.length];

    const newUser: AppUser = {
      id: 'usr_' + Date.now(),
      username: cleanName,
      password: payload.password?.trim() || 'empresa2026',
      nombreCompleto: payload.nombreCompleto.trim() || cleanName,
      rol: 'USUARIO',
      color: assignedColor,
      debeCambiarPassword: false,
      fechaCreacion: new Date().toISOString()
    };

    const updatedList = [...this.users(), newUser];
    this.users.set(updatedList);
    this.persistUsers(updatedList);

    return { success: true, message: `Usuario "${newUser.nombreCompleto}" creado exitosamente.`, user: newUser };
  }

  logout(): void {
    this.currentUser.set(null);
    localStorage.removeItem(CURRENT_USER_KEY);
  }

  /**
   * Permite cambio rápido de identidad para pruebas multi-pantalla o ante el docente
   */
  switchUser(user: AppUser): void {
    this.currentUser.set(user);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }
}
