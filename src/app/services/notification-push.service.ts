import { Injectable, inject, signal, computed } from '@angular/core';
import { AuthSessionService } from './auth-session.service';
import { ProjectWorkspaceService } from './project-workspace.service';
import { ProjectInvitation } from '../models/collaboration.models';

const INVITATIONS_STORAGE_KEY = 'case_enterprise_invitations';

@Injectable({
  providedIn: 'root'
})
export class NotificationPushService {
  private authService = inject(AuthSessionService);
  private projectService = inject(ProjectWorkspaceService);

  // Lista global reactiva de invitaciones
  invitations = signal<ProjectInvitation[]>([]);

  // Notificación flotante emergente tipo Push Banner
  activePushToast = signal<ProjectInvitation | null>(null);

  // Canal de difusión en tiempo real entre pestañas y ventanas
  private channel: BroadcastChannel | null = null;
  private audioCtx: AudioContext | null = null;
  private syncPollTimer: any = null;
  private lastNotifiedId: string | null = null;

  // Invitaciones pendientes dirigidas al usuario autenticado actual
  pendingInvitationsForCurrentUser = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];
    return this.invitations().filter(inv => 
      inv.targetUserId === user.id && inv.status === 'PENDING'
    );
  });

  // Conteo de notificaciones pendientes
  unreadCount = computed(() => this.pendingInvitationsForCurrentUser().length);

  constructor() {
    this.initInvitations();
    this.initBroadcastChannel();
    this.requestBrowserNotificationPermission();
    this.startBackgroundSync();
  }

  private getBackendUrl(): string {
    if (typeof window === 'undefined') return 'http://localhost:8080';
    const host = window.location.hostname || 'localhost';
    return `${window.location.protocol}//${host}:8080`;
  }

  public initInvitations(): void {
    let stored: ProjectInvitation[] = [];
    try {
      const raw = localStorage.getItem(INVITATIONS_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }
    this.invitations.set(stored);
    this.fetchInvitationsFromBackend();
  }

  private startBackgroundSync(): void {
    if (typeof window === 'undefined') return;
    if (this.syncPollTimer) clearInterval(this.syncPollTimer);
    // Polling ligero cada 2.5 segundos para sincronización entre diferentes dispositivos y navegadores
    this.syncPollTimer = setInterval(() => {
      this.fetchInvitationsFromBackend();
    }, 2500);
  }

  public fetchInvitationsFromBackend(): void {
    if (typeof window === 'undefined') return;
    const url = `${this.getBackendUrl()}/api/v1/invitaciones`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        const backendList: ProjectInvitation[] = data?.datos || (Array.isArray(data) ? data : []);
        if (Array.isArray(backendList)) {
          // Fusionar con invitaciones locales
          const merged = [...backendList];
          for (const localInv of this.invitations()) {
            if (!merged.some(m => m.id === localInv.id)) {
              merged.push(localInv);
            }
          }
          this.invitations.set(merged);
          this.persistInvitations(merged);
          this.verifyNewPendingToast();
        }
      })
      .catch(() => {});
  }

  private verifyNewPendingToast(): void {
    const user = this.authService.currentUser();
    if (!user) return;
    const pending = this.pendingInvitationsForCurrentUser();
    if (pending.length > 0) {
      const latest = pending[0];
      if (this.lastNotifiedId !== latest.id) {
        this.lastNotifiedId = latest.id;
        this.activePushToast.set(latest);
        this.triggerNativePushNotification(
          '🔔 Nueva Solicitud de Colaboración',
          `${latest.senderName} te ha invitado a colaborar en "${latest.projectName}" como ${latest.role === 'EDITOR' ? 'Editor' : 'Lector'}.`,
          latest.id
        );
      }
    } else {
      this.lastNotifiedId = null;
    }
  }

  public checkPendingInvitationsOnLogin(): void {
    this.fetchInvitationsFromBackend();
    const user = this.authService.currentUser();
    if (!user) return;
    const pending = this.pendingInvitationsForCurrentUser();
    if (pending.length > 0) {
      const latest = pending[0];
      this.lastNotifiedId = latest.id;
      this.activePushToast.set(latest);
      this.triggerNativePushNotification(
        '🔔 Solicitud de Colaboración Pendiente',
        `${latest.senderName} te ha invitado a colaborar en "${latest.projectName}" como ${latest.role === 'EDITOR' ? 'Editor' : 'Lector'}.`,
        latest.id
      );
    }
  }

  private persistInvitations(list: ProjectInvitation[]): void {
    try {
      localStorage.setItem(INVITATIONS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  }

  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('case_uml_notifications_channel');
      this.channel.onmessage = (event: MessageEvent) => {
        const payload = event.data;
        if (payload?.type === 'NEW_INVITATION') {
          this.handleIncomingInvitation(payload.invitation);
        } else if (payload?.type === 'INVITATION_ACCEPTED') {
          this.handleInvitationAcceptedByOther(payload.invitation);
        } else if (payload?.type === 'SYNC_INVITATIONS') {
          this.fetchInvitationsFromBackend();
        }
      };
    }
  }

  /**
   * Solicita permisos nativos al navegador para Notificaciones Push del Sistema Operativo
   */
  requestBrowserNotificationPermission(): void {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }

  /**
   * Emite una notificación nativa del navegador (visible incluso si el usuario está en otra pestaña/app)
   */
  private triggerNativePushNotification(title: string, body: string, tag: string): void {
    this.playNotificationChime();

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag,
          requireInteraction: true // Permanece hasta que el usuario interactúe
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (e) {
        console.warn('Native push error:', e);
      }
    }
  }

  /**
   * Reproduce un sonido de notificación armónico sintetizado con Web Audio API (sin dependencias de archivos externos)
   */
  private playNotificationChime(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // Re 5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // La 5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25); // Re 6

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now + 0.05);
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);
    } catch (e) {}
  }

  private handleIncomingInvitation(invitation: ProjectInvitation): void {
    this.fetchInvitationsFromBackend();
    const currentUser = this.authService.currentUser();
    if (currentUser && invitation.targetUserId === currentUser.id && invitation.status === 'PENDING') {
      this.lastNotifiedId = invitation.id;
      this.activePushToast.set(invitation);
      this.triggerNativePushNotification(
        '🔔 Invitación a Colaborar - CASE UML',
        `${invitation.senderName} te ha invitado como ${invitation.role === 'EDITOR' ? 'Editor' : 'Lector'} en "${invitation.projectName}".`,
        invitation.id
      );
    }
  }

  private handleInvitationAcceptedByOther(invitation: ProjectInvitation): void {
    this.fetchInvitationsFromBackend();
    const currentUser = this.authService.currentUser();
    if (currentUser && invitation.senderId === currentUser.id) {
      this.triggerNativePushNotification(
        '🎉 Invitación Aceptada - CASE UML',
        `${invitation.targetFullName} ha aceptado unirse como colaborador a "${invitation.projectName}".`,
        'accepted_' + invitation.id
      );
    }
  }

  /**
   * Enviar invitación formal de colaboración a un usuario del sistema (Sincronizado con Backend y WebSocket)
   */
  sendInvitation(
    projectId: string,
    projectName: string,
    targetUserId: string,
    targetUsername: string,
    targetFullName: string,
    role: 'EDITOR' | 'VIEWER'
  ): { success: boolean; message: string } {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return { success: false, message: 'No hay usuario autenticado.' };
    }

    // Verificar si ya tiene una invitación pendiente para el mismo proyecto
    const existing = this.invitations().find(
      i => i.projectId === projectId && i.targetUserId === targetUserId && i.status === 'PENDING'
    );
    if (existing) {
      return { success: false, message: `Ya existe una solicitud pendiente enviada a ${targetFullName}.` };
    }

    const newInvitation: ProjectInvitation = {
      id: 'inv_' + Date.now(),
      projectId,
      projectName,
      senderId: currentUser.id,
      senderName: currentUser.nombreCompleto,
      targetUserId,
      targetUsername,
      targetFullName,
      role,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    const updated = [newInvitation, ...this.invitations().filter(i => i.id !== newInvitation.id)];
    this.invitations.set(updated);
    this.persistInvitations(updated);

    // 1. Enviar al Backend REST (Persistencia centralizada para cualquier dispositivo en red)
    fetch(`${this.getBackendUrl()}/api/v1/invitaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInvitation)
    }).catch(err => console.warn('Error enviando invitacion al backend:', err));

    // 2. Difundir por BroadcastChannel (0ms en el mismo equipo)
    this.channel?.postMessage({
      type: 'NEW_INVITATION',
      invitation: newInvitation
    });

    return { 
      success: true, 
      message: `Solicitud de colaboración enviada a ${targetFullName} (${role === 'EDITOR' ? 'Editor' : 'Lector'}).` 
    };
  }

  /**
   * Aceptar invitación formal: se le concede el permiso y se agrega como colaborador al proyecto
   */
  acceptInvitation(invitationId: string): boolean {
    const inv = this.invitations().find(i => i.id === invitationId);
    if (!inv) return false;

    // 1. Asignar el rol en el proyecto activo y en el catálogo global de proyectos
    this.projectService.updateCollaboratorPermission(inv.projectId, inv.targetUserId, inv.role);

    // 2. Marcar invitación como aceptada
    const updated = this.invitations().map(i => 
      i.id === invitationId ? { ...i, status: 'ACCEPTED' as const, acceptedAt: new Date().toISOString() } : i
    );
    this.invitations.set(updated);
    this.persistInvitations(updated);

    // Ocultar toast si estaba visible
    if (this.activePushToast()?.id === invitationId) {
      this.activePushToast.set(null);
    }

    // 3. Notificar al backend REST
    fetch(`${this.getBackendUrl()}/api/v1/invitaciones/aceptar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId, id: invitationId })
    }).then(() => {
      this.projectService.fetchProjectsFromBackend();
    }).catch(err => console.warn('Error aceptando invitacion en backend:', err));

    // 4. Notificar por BroadcastChannel
    this.channel?.postMessage({
      type: 'INVITATION_ACCEPTED',
      invitation: inv
    });

    this.triggerNativePushNotification(
      '✅ Colaboración Confirmada',
      `Te has unido exitosamente al proyecto "${inv.projectName}" como ${inv.role === 'EDITOR' ? 'Editor' : 'Lector'}.`,
      'joined_' + inv.id
    );

    return true;
  }

  /**
   * Rechazar invitación formal
   */
  rejectInvitation(invitationId: string): boolean {
    const inv = this.invitations().find(i => i.id === invitationId);
    if (!inv) return false;

    const updated = this.invitations().map(i => 
      i.id === invitationId ? { ...i, status: 'REJECTED' as const } : i
    );
    this.invitations.set(updated);
    this.persistInvitations(updated);

    if (this.activePushToast()?.id === invitationId) {
      this.activePushToast.set(null);
    }

    fetch(`${this.getBackendUrl()}/api/v1/invitaciones/rechazar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId, id: invitationId })
    }).catch(() => {});

    this.channel?.postMessage({ type: 'SYNC_INVITATIONS' });
    return true;
  }

  /**
   * Cancelar una invitación pendiente (solo permitido para el Propietario emisor)
   */
  cancelInvitation(invitationId: string): void {
    const updated = this.invitations().filter(i => i.id !== invitationId);
    this.invitations.set(updated);
    this.persistInvitations(updated);

    fetch(`${this.getBackendUrl()}/api/v1/invitaciones/rechazar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId, id: invitationId })
    }).catch(() => {});

    this.channel?.postMessage({ type: 'SYNC_INVITATIONS' });
  }

  /**
   * Obtiene las invitaciones pendientes para un proyecto específico
   */
  getPendingInvitationsForProject(projectId: string): ProjectInvitation[] {
    return this.invitations().filter(
      i => i.projectId === projectId && i.status === 'PENDING'
    );
  }

  dismissToast(): void {
    this.activePushToast.set(null);
  }
}
