export type UserRole = 'ADMINISTRADOR' | 'USUARIO';

export interface AppUser {
  id: string;
  username: string;
  password?: string;
  nombreCompleto: string;
  rol: UserRole;
  departamento?: string;
  color: string; // Color distintivo para cursores y candados (ej. #0ea5e9)
  debeCambiarPassword: boolean;
  avatarUrl?: string;
  fechaCreacion: string;
}

export type ProjectPermission = 'OWNER' | 'EDITOR' | 'VIEWER' | 'NONE';

export interface ProjectCollaborator {
  userId: string;
  username: string;
  nombreCompleto: string;
  color: string;
  permission: ProjectPermission; // 'EDITOR' | 'VIEWER' | 'NONE'
  canDownloadBackend?: boolean; // Permiso explícito delegado por el Dueño para descargar el ZIP del backend
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  colaboradores: ProjectCollaborator[];
  totalClases: number;
  totalRelaciones: number;
  createdAt: string;
  updatedAt: string;
}

export interface OnlineUser {
  userId: string;
  username: string;
  nombreCompleto: string;
  color: string;
  permission: ProjectPermission;
  connectedAt: string;
}

export interface ElementLock {
  elementId: string;
  userId: string;
  userName: string;
  userColor: string;
  timestamp: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userColor: string;
  action: string;
  targetName?: string;
  details?: string;
}

export type WsMessageType = 
  | 'JOIN_ROOM'
  | 'LEAVE_ROOM'
  | 'ROOM_USERS'
  | 'LOCK_ELEMENT'
  | 'UNLOCK_ELEMENT'
  | 'ELEMENT_LOCKED'
  | 'ELEMENT_UNLOCKED'
  | 'ACTIVE_LOCKS'
  | 'MOVE_ELEMENT'
  | 'ELEMENT_MOVED'
  | 'SYNC_DIAGRAM'
  | 'DIAGRAM_SYNCED'
  | 'PERMISSION_CHANGED'
  | 'AUDIT_EVENT';

export interface WsMessagePayload {
  type: WsMessageType;
  projectId: string;
  userId?: string;
  user?: OnlineUser;
  elementId?: string;
  lock?: ElementLock;
  locks?: ElementLock[];
  users?: OnlineUser[];
  position?: { x: number; y: number };
  diagram?: any;
  audit?: AuditLogEntry;
  permissionChange?: { targetUserId: string; newPermission: ProjectPermission };
}
