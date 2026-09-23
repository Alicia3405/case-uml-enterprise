import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import { ProjectWorkspaceService } from './project-workspace.service';
import { 
  OnlineUser, 
  ElementLock, 
  AuditLogEntry, 
  WsMessagePayload, 
  ProjectPermission 
} from '../models/collaboration.models';

@Injectable({
  providedIn: 'root'
})
export class CollaborationSocketService {
  private authService = inject(AuthSessionService);
  private projectService = inject(ProjectWorkspaceService);

  // Estado reactivo de presencia, candados y red
  activeUsers = signal<OnlineUser[]>([]);
  activeLocks = signal<Map<string, ElementLock>>(new Map());
  auditLog = signal<AuditLogEntry[]>([]);
  isConnected = signal<boolean>(false);
  isNetworkOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Streams de eventos para el lienzo UML
  remoteElementMove$ = new Subject<{ elementId: string; x: number; y: number; userId: string }>();
  remoteDiagramSync$ = new Subject<{ diagram: any; userId: string }>();
  remotePermissionChange$ = new Subject<{ targetUserId: string; newPermission: ProjectPermission }>();
  remoteNotification$ = new Subject<string>();

  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private currentProjectId: string = '';
  private heartbeatTimer: any = null;

  constructor() {
    this.initNetworkStatusListener();
    this.initBroadcastChannel();
  }

  private initNetworkStatusListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isNetworkOnline.set(true);
        this.remoteNotification$.next('💚 Conexión a Internet restablecida (En línea).');
      });
      window.addEventListener('offline', () => {
        this.isNetworkOnline.set(false);
        this.remoteNotification$.next('🔴 Se perdió la conexión a Internet (Modo Offline).');
      });
    }
  }

  /**
   * Inicializa canal de difusión local entre pestañas/navegadores del mismo equipo (0ms latencia)
   */
  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('case_uml_collab_bus');
      this.channel.onmessage = (event: MessageEvent<WsMessagePayload>) => {
        this.handleIncomingPayload(event.data);
      };
    }
  }

  /**
   * Conecta a la sala del proyecto colaborativo
   */
  joinProjectRoom(projectId: string): void {
    this.currentProjectId = projectId;
    this.activeLocks.set(new Map());
    this.activeUsers.set([]);

    // Cargar bitácora persistida exclusivamente para este proyecto
    let storedAudit: AuditLogEntry[] = [];
    try {
      const raw = localStorage.getItem('case_audit_' + projectId);
      if (raw) storedAudit = JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }
    this.auditLog.set(storedAudit);

    const user = this.authService.currentUser();
    if (!user) return;

    const permission = this.projectService.getUserPermission(projectId, user.id);
    const onlineUser: OnlineUser = {
      userId: user.id,
      username: user.username,
      nombreCompleto: user.nombreCompleto,
      color: user.color,
      permission: permission,
      connectedAt: new Date().toISOString()
    };

    // Actualizar lista local inicial
    this.updateLocalPresence(onlineUser);

    // Conectar por WebSocket nativo al servidor local (para múltiples dispositivos en red)
    this.connectWebSocket(projectId, onlineUser);

    // Notificar presencia por BroadcastChannel
    this.broadcastMessage({
      type: 'JOIN_ROOM',
      projectId,
      user: onlineUser
    });

    // Registrar en bitácora
    this.addAuditEntry('Ingresó a la sesión colaborativa', user.nombreCompleto);
  }

  private connectWebSocket(projectId: string, onlineUser: OnlineUser): void {
    if (typeof window === 'undefined') return;

    let wsUrl = (window as any).__env?.wsUrl;
    if (!wsUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      // Conectar por defecto al backend en el puerto 8080 con la IP / Host del navegador
      wsUrl = `${protocol}//${host}:8080/ws/uml`;
    }

    try {
      this.ws = new WebSocket(`${wsUrl}?project=${projectId}&user=${onlineUser.userId}`);

      this.ws.onopen = () => {
        this.isConnected.set(true);
        this.ws?.send(JSON.stringify({
          type: 'JOIN_ROOM',
          projectId,
          user: onlineUser
        }));
      };

      this.ws.onmessage = (evt) => {
        try {
          const payload: WsMessagePayload = JSON.parse(evt.data);
          this.handleIncomingPayload(payload);
        } catch (e) {
          console.error('Error parseando mensaje WS:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected.set(false);
      };

      this.ws.onerror = () => {
        // Si el backend WS se desconecta, BroadcastChannel mantiene la sincronización local
        this.isConnected.set(false);
      };
    } catch (e) {
      this.isConnected.set(false);
    }
  }

  /**
   * Procesa cualquier mensaje entrante (sea por WebSocket de red o por BroadcastChannel)
   */
  private handleIncomingPayload(payload: WsMessagePayload): void {
    if (!payload || payload.projectId !== this.currentProjectId) return;
    const currentUserId = this.authService.currentUser()?.id;

    switch (payload.type) {
      case 'JOIN_ROOM':
        if (payload.user && payload.user.userId !== currentUserId) {
          this.updateLocalPresence(payload.user);
          // Responder con nuestra propia presencia para que el nuevo usuario nos vea
          const me = this.authService.currentUser();
          if (me) {
            const myPerm = this.projectService.getUserPermission(this.currentProjectId, me.id);
            this.broadcastMessage({
              type: 'ROOM_USERS',
              projectId: this.currentProjectId,
              user: {
                userId: me.id,
                username: me.username,
                nombreCompleto: me.nombreCompleto,
                color: me.color,
                permission: myPerm,
                connectedAt: new Date().toISOString()
              }
            });
          }
        }
        break;

      case 'ROOM_USERS':
        if (payload.user) {
          this.updateLocalPresence(payload.user);
          if (payload.user.userId !== currentUserId) {
            this.remoteNotification$.next(`🟢 ${payload.user.nombreCompleto} se conectó al proyecto.`);
          }
        }
        break;

      case 'LEAVE_ROOM':
        if (payload.userId) {
          const leaving = this.activeUsers().find(u => u.userId === payload.userId);
          this.activeUsers.update(list => list.filter(u => u.userId !== payload.userId));
          if (leaving) {
            this.remoteNotification$.next(`⚪ ${leaving.nombreCompleto} salió de la sala.`);
          }
          // Liberar candados que tuviera ese usuario
          this.activeLocks.update(map => {
            const next = new Map(map);
            for (const [elemId, lock] of next.entries()) {
              if (lock.userId === payload.userId) {
                next.delete(elemId);
              }
            }
            return next;
          });
        }
        break;

      case 'LOCK_ELEMENT':
      case 'ELEMENT_LOCKED':
        if (payload.lock && payload.lock.userId !== currentUserId) {
          this.activeLocks.update(map => {
            const next = new Map(map);
            next.set(payload.lock!.elementId, payload.lock!);
            return next;
          });
          this.remoteNotification$.next(`🔒 ${payload.lock.userName} bloqueó un elemento para editarlo.`);
        }
        break;

      case 'UNLOCK_ELEMENT':
      case 'ELEMENT_UNLOCKED':
        if (payload.elementId) {
          this.activeLocks.update(map => {
            const next = new Map(map);
            next.delete(payload.elementId!);
            return next;
          });
        }
        break;

      case 'MOVE_ELEMENT':
      case 'ELEMENT_MOVED':
        if (payload.elementId && payload.position && payload.userId !== currentUserId) {
          this.remoteElementMove$.next({
            elementId: payload.elementId,
            x: payload.position.x,
            y: payload.position.y,
            userId: payload.userId || ''
          });
        }
        break;

      case 'SYNC_DIAGRAM':
      case 'DIAGRAM_SYNCED':
        if (payload.diagram && payload.userId !== currentUserId) {
          this.remoteDiagramSync$.next({
            diagram: payload.diagram,
            userId: payload.userId || ''
          });
        }
        break;

      case 'PERMISSION_CHANGED':
        if (payload.permissionChange) {
          this.remotePermissionChange$.next(payload.permissionChange);
          // Actualizar presencia local si está presente
          this.activeUsers.update(list => list.map(u => {
            if (u.userId === payload.permissionChange!.targetUserId) {
              return { ...u, permission: payload.permissionChange!.newPermission };
            }
            return u;
          }));
          if (currentUserId === payload.permissionChange.targetUserId) {
            const roleName = payload.permissionChange.newPermission === 'EDITOR' ? 'Editor' : (payload.permissionChange.newPermission === 'VIEWER' ? 'Lector' : 'Sin Acceso');
            this.remoteNotification$.next(`🔔 Tu rol en este proyecto ha sido actualizado a: ${roleName}`);
          }
        }
        break;

      case 'AUDIT_EVENT':
        if (payload.audit && payload.projectId === this.currentProjectId) {
          this.auditLog.update(log => {
            const updated = [payload.audit!, ...log.slice(0, 49)];
            try {
              if (this.currentProjectId) {
                localStorage.setItem('case_audit_' + this.currentProjectId, JSON.stringify(updated));
              }
            } catch (e) {}
            return updated;
          });
        }
        break;
    }
  }

  private updateLocalPresence(user: OnlineUser): void {
    this.activeUsers.update(list => {
      const idx = list.findIndex(u => u.userId === user.userId);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = user;
        return next;
      }
      return [...list, user];
    });
  }

  /**
   * Solicita el candado de exclusión mutua para un elemento UML (Clase, Rombo, etc.)
   */
  requestLock(elementId: string): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;

    // Verificar si el usuario tiene permiso de edición
    const permission = this.projectService.getUserPermission(this.currentProjectId, user.id);
    if (permission !== 'OWNER' && permission !== 'EDITOR') {
      return false;
    }

    // Verificar si otro usuario ya posee el candado
    const existingLock = this.activeLocks().get(elementId);
    if (existingLock && existingLock.userId !== user.id) {
      return false; // Bloqueado por otro usuario
    }

    const lock: ElementLock = {
      elementId,
      userId: user.id,
      userName: user.nombreCompleto,
      userColor: user.color,
      timestamp: Date.now()
    };

    // Actualizar estado local
    this.activeLocks.update(map => {
      const next = new Map(map);
      next.set(elementId, lock);
      return next;
    });

    // Difundir candado
    this.broadcastMessage({
      type: 'LOCK_ELEMENT',
      projectId: this.currentProjectId,
      lock
    });

    return true;
  }

  /**
   * Libera el candado de exclusión mutua
   */
  releaseLock(elementId: string): void {
    const user = this.authService.currentUser();
    if (!user) return;

    const existingLock = this.activeLocks().get(elementId);
    if (existingLock && existingLock.userId !== user.id) {
      return; // No puede liberar un candado que no le pertenece
    }

    this.activeLocks.update(map => {
      const next = new Map(map);
      next.delete(elementId);
      return next;
    });

    this.broadcastMessage({
      type: 'UNLOCK_ELEMENT',
      projectId: this.currentProjectId,
      elementId,
      userId: user.id
    });
  }

  /**
   * Verifica si un elemento está bloqueado por otro usuario
   */
  isLockedByOther(elementId: string): ElementLock | null {
    const currentUserId = this.authService.currentUser()?.id;
    const lock = this.activeLocks().get(elementId);
    if (lock && lock.userId !== currentUserId) {
      return lock;
    }
    return null;
  }

  /**
   * Emite el movimiento en tiempo real de una caja
   */
  emitElementMove(elementId: string, x: number, y: number): void {
    const user = this.authService.currentUser();
    if (!user) return;

    this.broadcastMessage({
      type: 'MOVE_ELEMENT',
      projectId: this.currentProjectId,
      elementId,
      position: { x, y },
      userId: user.id
    });
  }

  /**
   * Emite la sincronización de una modificación en el diagrama
   */
  emitDiagramChange(diagram: any, actionDescription?: string, targetName?: string): void {
    const user = this.authService.currentUser();
    if (!user) return;

    this.broadcastMessage({
      type: 'SYNC_DIAGRAM',
      projectId: this.currentProjectId,
      diagram,
      userId: user.id
    });

    if (actionDescription) {
      this.addAuditEntry(actionDescription, targetName);
    }
  }

  private addAuditEntry(action: string, targetName?: string): void {
    const user = this.authService.currentUser();
    if (!user) return;

    const entry: AuditLogEntry = {
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.nombreCompleto,
      userColor: user.color,
      action,
      targetName
    };

    this.auditLog.update(log => {
      const updated = [entry, ...log.slice(0, 49)];
      try {
        if (this.currentProjectId) {
          localStorage.setItem('case_audit_' + this.currentProjectId, JSON.stringify(updated));
        }
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    this.broadcastMessage({
      type: 'AUDIT_EVENT',
      projectId: this.currentProjectId,
      audit: entry
    });
  }

  emitPermissionChange(targetUserId: string, newPermission: ProjectPermission): void {
    this.broadcastMessage({
      type: 'PERMISSION_CHANGED',
      projectId: this.currentProjectId,
      permissionChange: { targetUserId, newPermission }
    });
  }

  private broadcastMessage(payload: WsMessagePayload): void {
    // 1. Canal local BroadcastChannel (sincroniza pestañas en 0ms)
    try {
      this.channel?.postMessage(payload);
    } catch (e) {
      console.error(e);
    }

    // 2. WebSocket de red (sincroniza diferentes dispositivos conectados a la IP)
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(payload));
      }
    } catch (e) {
      console.error(e);
    }
  }

  leaveRoom(): void {
    const user = this.authService.currentUser();
    if (user && this.currentProjectId) {
      this.broadcastMessage({
        type: 'LEAVE_ROOM',
        projectId: this.currentProjectId,
        userId: user.id
      });
    }
    this.activeLocks.set(new Map());
    this.activeUsers.set([]);
    this.currentProjectId = '';
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  leaveProjectRoom(): void {
    this.leaveRoom();
  }
}
