import { Component, ElementRef, ViewChild, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  UmlAttribute, 
  UmlClass, 
  UmlDataType, 
  UmlDiagram, 
  UmlElementType, 
  UmlMethod, 
  UmlRelation, 
  UmlRelationType, 
  UmlVisibility,
  XmiValidationReport 
} from '../../models/uml.models';
import { XmiService } from '../../services/xmi.service';
import { VoiceCommandService, ParsedVoiceCommand } from '../../services/voice-command.service';
import { UmlVisionService, VisionScanResult } from '../../services/uml-vision.service';
import { UmlVoiceDockComponent } from '../../components/uml-voice-dock/uml-voice-dock.component';
import { UmlVisionModalComponent } from '../../components/uml-vision-modal/uml-vision-modal.component';
import { BackendExportModalComponent } from '../../components/backend-export-modal/backend-export-modal.component';
import { UmlPromptModalComponent } from '../../components/uml-prompt-modal/uml-prompt-modal.component';
import { UserProfileModalComponent } from '../../components/user-profile-modal/user-profile-modal.component';
import { UmlAuditModalComponent } from '../../components/uml-audit-modal/uml-audit-modal.component';
import { PromptGeneratedResult } from '../../services/uml-prompt-generator.service';
import { SpringBootGeneratorService } from '../../services/spring-boot-generator.service';
import { AuthSessionService } from '../../services/auth-session.service';
import { ProjectWorkspaceService } from '../../services/project-workspace.service';
import { CollaborationSocketService } from '../../services/collaboration-socket.service';
import { NotificationPushService } from '../../services/notification-push.service';
import { ElementLock, ProjectPermission, ProjectSummary } from '../../models/collaboration.models';
import { copyToClipboard } from '../../utils/clipboard-helper';

@Component({
  selector: 'app-uml-workspace',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    UmlVoiceDockComponent, 
    UmlVisionModalComponent,
    BackendExportModalComponent,
    UmlPromptModalComponent,
    UserProfileModalComponent,
    UmlAuditModalComponent
  ],
  templateUrl: './uml-workspace.component.html',
  styleUrl: './uml-workspace.component.css'
})
export class UmlWorkspaceComponent {
  private xmiService = inject(XmiService);
  public voiceService = inject(VoiceCommandService);
  private visionService = inject(UmlVisionService);
  public authService = inject(AuthSessionService);
  public projectService = inject(ProjectWorkspaceService);
  public collabSocket = inject(CollaborationSocketService);
  public generatorService = inject(SpringBootGeneratorService);
  public notifService = inject(NotificationPushService);

  showProfileModal = signal<boolean>(false);
  showNotificationsModal = signal<boolean>(false);

  @ViewChild('canvasContainer') canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('xmiFileInput') xmiFileInput!: ElementRef<HTMLInputElement>;

  // Estado del Diagrama UML
  diagram = signal<UmlDiagram>({
    id: 'diag_1',
    name: 'Sistema de Gestión - Modelo Conceptual',
    description: 'Diagrama de clases UML 2.5 compatible con Enterprise Architect',
    classes: [],
    relations: [],
    version: '1.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Selección y modos
  selectedClassId = signal<string | null>(null);
  selectedRelationId = signal<string | null>(null);
  isConnecting = signal<boolean>(false);
  connectionSourceId = signal<string | null>(null);
  selectedRelationType = signal<UmlRelationType>('ONE_TO_MANY');

  // Toolbox colapsable
  toolboxOpen = signal<boolean>(true);
  activeToolCategory = signal<'STRUCTURE' | 'BEHAVIOR' | 'CONNECTORS'>('STRUCTURE');
  protected readonly Math = Math;

  // Zoom y Panning
  zoom = signal<number>(1);
  panX = signal<number>(50);
  panY = signal<number>(50);
  isPanning = signal<boolean>(false);
  lastMouseX = 0;
  lastMouseY = 0;

  // Arrastre de Clases
  draggingClassId = signal<string | null>(null);
  dragOffsetX = 0;
  dragOffsetY = 0;

  // Modal DDL SQL
  showDdlModal = signal<boolean>(false);
  generatedDdl = signal<string>('');

  // Modal Visor y Validador XMI
  showXmiModal = signal<boolean>(false);
  generatedXmi = signal<string>('');
  validationReport = signal<XmiValidationReport | null>(null);

  // Notificaciones Toast
  notificationMessage = signal<string>('');

  // Modal Digitalizador de Pizarra con IA (Vision)
  showVisionModal = signal<boolean>(false);

  // Modal de Auditoría y Normalización de Base de Datos (1NF, 2NF, 3NF)
  showAuditModal = signal<boolean>(false);

  // Control de Vistas Principales: LOGIN -> DASHBOARD -> WORKSPACE
  currentView = signal<'LOGIN' | 'DASHBOARD' | 'WORKSPACE'>('LOGIN');

  // Pestaña activa en la Barra Lateral Izquierda del Workspace: TOOLS | COLLABORATORS | AUDIT
  activeSidebarTab = signal<'TOOLS' | 'COLLABORATORS' | 'AUDIT'>('TOOLS');

  // Estado del Modal de Nuevo Proyecto en Dashboard
  showNewProjectModal = signal<boolean>(false);
  newProjectName = signal<string>('');
  newProjectDescription = signal<string>('');

  // Estado de administración en Dashboard
  adminActiveTab = signal<'USERS' | 'PROJECTS'>('PROJECTS');
  adminProjectFilter = signal<string>('ALL');
  adminNewFullName = signal<string>('');
  adminNewUsername = signal<string>('');
  adminNewDepartment = signal<string>('Desarrollo de Software');
  adminNewInitialPassword = signal<string>('empresa2026');
  adminSuccessMsg = signal<string>('');
  adminErrorMsg = signal<string>('');

  // Formulario de login directo
  loginUsername = signal<string>('');
  loginPassword = signal<string>('');
  loginError = signal<string>('');
  changePassCurrent = signal<string>('');
  changePassNew = signal<string>('');
  changePassConfirm = signal<string>('');

  // Proyectos clasificados para el Dashboard
  myProjects = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];
    return this.projectService.projects().filter(p => p.ownerId === user.id);
  });

  sharedProjects = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];
    return this.projectService.projects().filter(p => 
      p.ownerId !== user.id && 
      p.colaboradores.some(c => c.userId === user.id && c.permission !== 'NONE')
    );
  });

  // Historial de descargas privadas: solo visible en el dashboard del Propietario del diagrama
  ownerBackendHistory = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];
    return this.generatorService.history().filter(h => h.ownerId === user.id);
  });

  // Potestades de exportación de backend para el proyecto activo
  isCurrentProjectOwner = computed(() => {
    const user = this.authService.currentUser();
    const active = this.projectService.activeProject();
    if (!user || !active) return false;
    return active.ownerId === user.id;
  });

  canDownloadCurrentProject = computed(() => {
    const user = this.authService.currentUser();
    const projId = this.projectService.activeProjectId();
    if (!user || !projId) return false;
    return this.projectService.canUserDownloadBackend(projId, user.id);
  });

  // Barra lateral izquierda colapsable (Ocultar / Mostrar)
  isSidebarCollapsed = signal<boolean>(false);

  toggleSidebar() {
    this.isSidebarCollapsed.update(v => !v);
  }

  // Búsqueda en tiempo real en el Dashboard del Administrador
  adminSearchTerm = signal<string>('');

  filteredAdminProjects = computed(() => {
    const filter = this.adminProjectFilter();
    const term = this.adminSearchTerm().trim().toLowerCase();
    let list = this.projectService.projects();
    if (filter !== 'ALL') {
      list = list.filter(p => p.ownerId === filter);
    }
    if (term) {
      list = list.filter(p => {
        const displayName = this.getProjectDisplayName(p).toLowerCase();
        const ownerName = (this.getOwnerName(p.ownerId) || p.ownerName || '').toLowerCase();
        return (
          displayName.includes(term) || 
          p.description.toLowerCase().includes(term) || 
          ownerName.includes(term)
        );
      });
    }
    return list;
  });

  filteredAdminUsers = computed(() => {
    const term = this.adminSearchTerm().trim().toLowerCase();
    const all = this.authService.users();
    if (!term) return all;
    return all.filter(u => 
      u.username.toLowerCase().includes(term) || 
      u.nombreCompleto.toLowerCase().includes(term)
    );
  });

  // Búsqueda en tiempo real de miembros del equipo en barra lateral
  memberSearchTerm = signal<string>('');
  selectedUserToAdd = signal<string>('');
  selectedRoleToAdd = signal<ProjectPermission>('EDITOR');

  // Solo miembros activos asignados a este proyecto (Dueño + Colaboradores con EDITOR o VIEWER)
  filteredTeamMembers = computed(() => {
    const proj = this.projectService.activeProject();
    if (!proj) return [];
    const term = this.memberSearchTerm().trim().toLowerCase();
    const allUsers = this.authService.users();

    // Filtrar solo los usuarios que son el Dueño o están en la lista de colaboradores con rol activo
    const team = allUsers.filter(u => {
      if (proj.ownerId === u.id) return true;
      return proj.colaboradores.some(c => c.userId === u.id && (c.permission === 'EDITOR' || c.permission === 'VIEWER'));
    });

    if (!term) return team;
    return team.filter(u => 
      u.nombreCompleto.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term)
    );
  });

  // Invitaciones pendientes para este proyecto activo
  pendingProjectInvitations = computed(() => {
    const projId = this.projectService.activeProjectId();
    if (!projId) return [];
    return this.notifService.getPendingInvitationsForProject(projId);
  });

  // Usuarios del sistema disponibles para ser asignados/invitados como colaboradores
  availableUsersToAdd = computed(() => {
    const proj = this.projectService.activeProject();
    if (!proj) return [];
    const allUsers = this.authService.users();
    const pendingInvites = this.pendingProjectInvitations();
    return allUsers.filter(u => {
      // Excluir al dueño
      if (proj.ownerId === u.id) return false;
      // Excluir a los que ya son colaboradores activos (EDITOR o VIEWER)
      const isAlreadyCollab = proj.colaboradores.some(c => c.userId === u.id && (c.permission === 'EDITOR' || c.permission === 'VIEWER'));
      if (isAlreadyCollab) return false;
      // Excluir a los que ya tienen una invitación pendiente
      const hasPending = pendingInvites.some(inv => inv.targetUserId === u.id);
      return !hasPending;
    });
  });

  // Modales del sistema colaborativo y administración
  showLoginModal = signal<boolean>(false);
  showAdminModal = signal<boolean>(false);
  showCollaboratorsModal = signal<boolean>(false);
  showAuditDrawer = signal<boolean>(false);

  // Permisos en tiempo real
  currentPermission = computed<ProjectPermission>(() => {
    const user = this.authService.currentUser();
    const projId = this.projectService.activeProjectId();
    if (!user) return 'NONE';
    return this.projectService.getUserPermission(projId, user.id);
  });

  isReadOnly = computed<boolean>(() => {
    const perm = this.currentPermission();
    return perm === 'VIEWER' || perm === 'NONE';
  });

  isBlocked = computed<boolean>(() => {
    return this.currentPermission() === 'NONE';
  });

  // Pila de Deshacer (Undo) y Rehacer (Redo)
  private historyStack: string[] = [];
  private redoStack: string[] = [];
  canUndo = signal<boolean>(false);
  canRedo = signal<boolean>(false);

  // Opciones predefinidas
  availableTypes: UmlDataType[] = [
    'Long', 'Integer', 'String', 'Double', 'Float', 'Boolean', 'LocalDate', 'LocalDateTime', 'BigDecimal', 'Text'
  ];
  availableVisibilities: UmlVisibility[] = ['+', '-', '#', '~'];

  selectedClass = computed(() => {
    const id = this.selectedClassId();
    if (!id) return null;
    return this.diagram().classes.find(c => c.id === id) || null;
  });

  constructor() {
    // 1. Validar autenticación inicial y proyectos en URL
    const user = this.authService.currentUser();
    let projParam: string | null = null;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      projParam = urlParams.get('project');
    }

    if (!user) {
      this.currentView.set('LOGIN');
    } else if (projParam) {
      this.abrirProyecto(projParam);
    } else {
      this.currentView.set('DASHBOARD');
    }

    // 2. Suscribirse a movimientos remotos de elementos (arrastre en vivo)
    this.collabSocket.remoteElementMove$.subscribe(({ elementId, x, y }) => {
      this.diagram.update(d => ({
        ...d,
        classes: d.classes.map(c => c.id === elementId ? { ...c, position: { x, y } } : c)
      }));
    });

    // 3. Suscribirse a cambios completos de diagrama por otros colaboradores
    this.collabSocket.remoteDiagramSync$.subscribe(({ diagram }) => {
      if (diagram && diagram.id) {
        this.diagram.set(diagram);
        this.saveCurrentProjectDiagram();
      }
    });

    // 4. Suscribirse a cambios de permisos en tiempo real
    this.collabSocket.remotePermissionChange$.subscribe(({ targetUserId, newPermission }) => {
      const activeId = this.projectService.activeProjectId();
      if (activeId) {
        this.projectService.updateCollaboratorPermission(activeId, targetUserId, newPermission);
      }
    });

    // 5. Suscribirse a notificaciones de sala
    this.collabSocket.remoteNotification$.subscribe(msg => {
      this.notify(msg);
    });

    // 5. Suscripción a comandos de voz
    this.voiceService.commandStream$.subscribe(cmd => this.handleVoiceCommand(cmd));
  }

  // --- NAVEGACIÓN Y ZOOM DEL LIENZO ---

  onWheel(event: WheelEvent) {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(0.4, this.zoom() * zoomFactor), 2.5);
    this.zoom.set(parseFloat(newZoom.toFixed(2)));
  }

  startPan(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const tag = target.tagName.toLowerCase();
    const isBg = tag === 'svg' || target.id === 'grid-bg' || tag === 'rect' || target.classList.contains('canvas-background');
    if (isBg) {
      this.isPanning.set(true);
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      // Deseleccionar elemento activo y liberar candado
      this.deseleccionarElemento();
    }
  }

  deseleccionarElemento() {
    const cur = this.selectedClassId();
    if (cur) {
      this.collabSocket.releaseLock(cur);
      this.selectedClassId.set(null);
    }
    this.selectedRelationId.set(null);
    if (this.isConnecting()) {
      this.cancelarConexion();
    }
  }

  onMouseMove(event: MouseEvent) {
    if (this.isPanning()) {
      const dx = event.clientX - this.lastMouseX;
      const dy = event.clientY - this.lastMouseY;
      this.panX.update(x => x + dx);
      this.panY.update(y => y + dy);
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      return;
    }

    const draggingId = this.draggingClassId();
    if (draggingId) {
      const currentZoom = this.zoom();
      const currentDiagram = this.diagram();
      let movedX = 10;
      let movedY = 10;
      const updatedClasses = currentDiagram.classes.map(c => {
        if (c.id === draggingId) {
          const newX = Math.round((event.clientX - this.dragOffsetX) / currentZoom);
          const newY = Math.round((event.clientY - this.dragOffsetY) / currentZoom);
          movedX = Math.max(10, newX);
          movedY = Math.max(10, newY);
          return {
            ...c,
            position: { x: movedX, y: movedY }
          };
        }
        return c;
      });

      this.diagram.set({
        ...currentDiagram,
        classes: updatedClasses,
        updatedAt: new Date().toISOString()
      });

      // Emitir arrastre remoto en vivo (0ms BroadcastChannel + WebSocket)
      this.collabSocket.emitElementMove(draggingId, movedX, movedY);
    }
  }

  onMouseUp() {
    this.isPanning.set(false);
    const releasedId = this.draggingClassId();
    if (releasedId) {
      this.draggingClassId.set(null);
      this.saveCurrentProjectDiagram();
      // Notificar cambio consolidado al servidor y compañeros
      this.collabSocket.emitDiagramChange(this.diagram(), 'Movió posición de elemento en el lienzo');
      // NOTA: El candado de exclusión mutua se mantiene mientras el usuario continúe
      // editando la clase en el Inspector lateral derecho.
      // Se liberará cuando el usuario deseleccione (clic en fondo del lienzo o cerrar inspector).
    }
  }

  setZoom(value: number) {
    this.zoom.set(Math.min(Math.max(0.4, value), 2.5));
  }

  resetView() {
    this.zoom.set(1);
    this.panX.set(50);
    this.panY.set(50);
  }

  // --- CREACIÓN DE DIFERENTES ELEMENTOS DEL DIAGRAMADOR ---

  agregarElemento(type: UmlElementType = 'CLASS', customName?: string): UmlClass {
    if (this.isReadOnly()) {
      this.notify('🔒 Modo Solo Lectura: No tienes permisos para crear elementos.');
      return {} as UmlClass;
    }
    
    // Liberar cualquier candado anterior que tuviera el usuario seleccionado
    const curSel = this.selectedClassId();
    if (curSel) {
      this.collabSocket.releaseLock(curSel);
    }

    const count = this.diagram().classes.length + 1;
    const baseId = 'elem_' + Date.now();
    const spawnX = Math.round((-this.panX() + 320 + (count % 4) * 40) / this.zoom());
    const spawnY = Math.round((-this.panY() + 140 + Math.floor(count / 4) * 40) / this.zoom());

    let newElem: UmlClass;

    switch (type) {
      case 'DECISION':
      case 'ASSOCIATION_CLASS':
        // Rombo de Decisión o Clase de Asociación
        newElem = {
          id: baseId,
          name: type === 'DECISION' ? '¿EsVálido?' : 'Asociación',
          elementType: type,
          stereotype: type === 'DECISION' ? '<<decisión>>' : '<<asociación>>',
          width: 140,
          height: 100,
          position: { x: spawnX, y: spawnY },
          attributes: [],
          methods: []
        };
        break;

      case 'INTERFACE':
        newElem = {
          id: baseId,
          name: `IProcesador${count}`,
          elementType: 'INTERFACE',
          stereotype: '<<interface>>',
          width: 220,
          height: 150,
          position: { x: spawnX, y: spawnY },
          attributes: [],
          methods: [
            { id: 'm_' + Date.now(), name: 'procesar', returnType: 'Boolean', visibility: '+' }
          ]
        };
        break;

      case 'ENUM':
        newElem = {
          id: baseId,
          name: `Estado${count}`,
          elementType: 'ENUM',
          stereotype: '<<enumeration>>',
          width: 190,
          height: 140,
          position: { x: spawnX, y: spawnY },
          attributes: [
            { id: 'a1', name: 'ACTIVO', type: 'String', visibility: '+', isPrimaryKey: false },
            { id: 'a2', name: 'PENDIENTE', type: 'String', visibility: '+', isPrimaryKey: false },
            { id: 'a3', name: 'INACTIVO', type: 'String', visibility: '+', isPrimaryKey: false }
          ],
          methods: []
        };
        break;

      case 'LIFELINE':
        // Línea de vida para Diagrama de Secuencia
        newElem = {
          id: baseId,
          name: `:Servicio${count}`,
          elementType: 'LIFELINE',
          stereotype: '<<lifeline>>',
          width: 160,
          height: 280,
          position: { x: spawnX, y: spawnY },
          attributes: [],
          methods: []
        };
        break;

      case 'ACTOR':
        newElem = {
          id: baseId,
          name: `Usuario`,
          elementType: 'ACTOR',
          stereotype: '<<actor>>',
          width: 120,
          height: 140,
          position: { x: spawnX, y: spawnY },
          attributes: [],
          methods: []
        };
        break;

      case 'NOTE':
        newElem = {
          id: baseId,
          name: 'Nota',
          elementType: 'NOTE',
          stereotype: '<<note>>',
          width: 200,
          height: 120,
          position: { x: spawnX, y: spawnY },
          noteContent: 'Regla de negocio: Esta entidad requiere validación previa antes de persistir.',
          attributes: [],
          methods: []
        };
        break;

      case 'PACKAGE':
        newElem = {
          id: baseId,
          name: `com.sistema.modulo${count}`,
          elementType: 'PACKAGE',
          stereotype: '<<package>>',
          width: 320,
          height: 220,
          position: { x: spawnX, y: spawnY },
          attributes: [],
          methods: []
        };
        break;

      case 'CLASS':
      default:
        // Clase UML 2.5 Estándar
        newElem = {
          id: baseId,
          name: `Entidad${count}`,
          elementType: 'CLASS',
          stereotype: '<<entity>>',
          width: 220,
          height: 170,
          position: { x: spawnX, y: spawnY },
          attributes: [
            { id: 'attr_' + Date.now(), name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
            { id: 'attr_' + (Date.now() + 1), name: 'nombre', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
          ],
          methods: [
            { id: 'm_' + Date.now(), name: 'getDetalles', returnType: 'String', visibility: '+' }
          ]
        };
        break;
    }

    if (customName) {
      newElem.name = customName;
    }

    this.diagram.update(d => ({
      ...d,
      classes: [...d.classes, newElem],
      updatedAt: new Date().toISOString()
    }));

    this.selectedClassId.set(newElem.id);
    this.saveCurrentProjectDiagram();
    this.collabSocket.emitDiagramChange(this.diagram(), `Agregó ${newElem.name} (${newElem.elementType})`);
    this.notify(`Elemento "${newElem.name}" agregado al lienzo.`);
    return newElem;
  }

  startDragClass(event: MouseEvent, cls: UmlClass) {
    event.stopPropagation();

    // 1. Control de Permisos: Si es solo lectura (VIEWER o NONE), bloquear edición
    if (this.isReadOnly()) {
      this.notify('🔒 Modo Solo Lectura: No tienes permisos para editar o mover elementos.');
      return;
    }

    // 2. Control de Exclusión Mutua: Verificar si otro usuario lo está editando
    const lock = this.collabSocket.isLockedByOther(cls.id);
    if (lock) {
      this.notify(`🔒 Bloqueado por ${lock.userName}. Está editando este elemento.`);
      return;
    }

    // 3. Liberar candado previo si el usuario ya estaba editando otra clase
    const prevSelectedId = this.selectedClassId();
    if (prevSelectedId && prevSelectedId !== cls.id) {
      this.collabSocket.releaseLock(prevSelectedId);
    }

    // 4. Adquirir candado de exclusión mutua para el nuevo elemento
    this.collabSocket.requestLock(cls.id);

    this.selectedClassId.set(cls.id);
    this.selectedRelationId.set(null);

    if (this.isConnecting()) {
      this.handleConnectionClick(cls.id);
      return;
    }

    this.draggingClassId.set(cls.id);
    const currentZoom = this.zoom();
    this.dragOffsetX = event.clientX - (cls.position.x * currentZoom);
    this.dragOffsetY = event.clientY - (cls.position.y * currentZoom);
  }

  eliminarClase(classId: string) {
    if (this.isReadOnly()) {
      this.notify('🔒 Modo Solo Lectura: No puedes eliminar elementos.');
      return;
    }

    const lock = this.collabSocket.isLockedByOther(classId);
    if (lock) {
      this.notify(`🔒 Bloqueado por ${lock.userName}. No puedes eliminarlo.`);
      return;
    }

    const cls = this.diagram().classes.find(c => c.id === classId);
    if (!cls) return;

    this.diagram.update(d => ({
      ...d,
      classes: d.classes.filter(c => c.id !== classId),
      relations: d.relations.filter(r => r.sourceClassId !== classId && r.targetClassId !== classId),
      updatedAt: new Date().toISOString()
    }));

    if (this.selectedClassId() === classId) {
      this.selectedClassId.set(null);
    }
    this.collabSocket.emitDiagramChange(this.diagram(), `Eliminó clase "${cls.name}"`);
    this.notify(`Elemento "${cls.name}" eliminado.`);
  }

  getStereotypeDisplay(cls: UmlClass): string {
    if (cls.stereotype) return cls.stereotype;
    if (cls.elementType === 'INTERFACE') return '«interface»';
    if (cls.elementType === 'ENUM') return '«enumeration»';
    if (cls.elementType === 'DECISION') return '«decisión»';
    if (cls.elementType === 'ASSOCIATION_CLASS') return '«asociación»';
    if (cls.elementType === 'LIFELINE') return '«lifeline»';
    if (cls.elementType === 'ACTOR') return '«actor»';
    if (cls.elementType === 'NOTE') return '«nota»';
    return '«entity»';
  }

  // --- ATRIBUTOS Y MÉTODOS ---

  agregarAtributo(cls: UmlClass) {
    const newAttr: UmlAttribute = {
      id: 'attr_' + Date.now(),
      name: 'nuevoCampo',
      type: 'String',
      visibility: '+',
      isPrimaryKey: false,
      isNullable: true
    };
    cls.attributes.push(newAttr);
    this.touchDiagram();
  }

  eliminarAtributo(cls: UmlClass, attrId: string) {
    cls.attributes = cls.attributes.filter(a => a.id !== attrId);
    this.touchDiagram();
  }

  agregarMetodo(cls: UmlClass) {
    const newMethod: UmlMethod = {
      id: 'm_' + Date.now(),
      name: 'nuevoMetodo',
      returnType: 'void',
      visibility: '+'
    };
    cls.methods.push(newMethod);
    this.touchDiagram();
  }

  eliminarMetodo(cls: UmlClass, methodId: string) {
    cls.methods = cls.methods.filter(m => m.id !== methodId);
    this.touchDiagram();
  }

  // --- RELACIONES Y CONECTORES ---

  seleccionarTipoRelacion(type: UmlRelationType) {
    this.selectedRelationType.set(type);
    this.isConnecting.set(true);
    this.connectionSourceId.set(null);
    this.notify(`Modo Conexión (${type}): Haz clic en la clase ORIGEN.`);
  }

  cancelarConexion() {
    this.isConnecting.set(false);
    this.connectionSourceId.set(null);
  }

  handleConnectionClick(classId: string) {
    const sourceId = this.connectionSourceId();
    if (!sourceId) {
      this.connectionSourceId.set(classId);
      const srcCls = this.diagram().classes.find(c => c.id === classId);
      this.notify(`Origen: "${srcCls?.name}". Ahora haz clic en la clase DESTINO.`);
    } else {
      if (sourceId === classId) {
        this.notify('No puedes relacionar un elemento consigo mismo.');
        return;
      }

      const srcCls = this.diagram().classes.find(c => c.id === sourceId);
      const tgtCls = this.diagram().classes.find(c => c.id === classId);
      const relType = this.selectedRelationType();

      let srcMulti = '1';
      let tgtMulti = '*';
      if (relType === 'ONE_TO_ONE') { srcMulti = '1'; tgtMulti = '1'; }
      else if (relType === 'ONE_TO_MANY') { srcMulti = '1'; tgtMulti = '0..*'; }
      else if (relType === 'MANY_TO_ONE') { srcMulti = '0..*'; tgtMulti = '1'; }
      else if (relType === 'MANY_TO_MANY') { srcMulti = '*'; tgtMulti = '*'; }
      else if (relType === 'INHERITANCE' || relType === 'REALIZATION') { srcMulti = ''; tgtMulti = ''; }
      else if (relType === 'SEQUENCE_MESSAGE') { srcMulti = ''; tgtMulti = '1: llamar()'; }

      const newRelation: UmlRelation = {
        id: 'rel_' + Date.now(),
        sourceClassId: sourceId,
        targetClassId: classId,
        type: relType,
        name: relType === 'INHERITANCE' ? '' : (relType === 'SEQUENCE_MESSAGE' ? 'mensaje()' : 'tiene'),
        sourceMultiplicity: srcMulti,
        targetMultiplicity: tgtMulti
      };

      this.diagram.update(d => ({
        ...d,
        relations: [...d.relations, newRelation],
        updatedAt: new Date().toISOString()
      }));

      this.isConnecting.set(false);
      this.connectionSourceId.set(null);
      this.collabSocket.emitDiagramChange(this.diagram(), `Conectó ${srcCls?.name} con ${tgtCls?.name}`);
      this.notify(`Conexión establecida: ${srcCls?.name} ➔ ${tgtCls?.name}`);
    }
  }

  conectarElemento(cls: UmlClass, port?: string) {
    this.handleConnectionClick(cls.id);
  }

  eliminarRelacion(relId: string) {
    if (this.isReadOnly()) {
      this.notify('🔒 Modo Solo Lectura: No puedes eliminar relaciones.');
      return;
    }
    this.diagram.update(d => ({
      ...d,
      relations: d.relations.filter(r => r.id !== relId),
      updatedAt: new Date().toISOString()
    }));
    this.selectedRelationId.set(null);
    this.collabSocket.emitDiagramChange(this.diagram(), 'Eliminó relación');
    this.notify('Relación eliminada.');
  }

  // --- CÁLCULO DE DIMENSIONES DINÁMICAS DE CLASES UML ---

  getClassWidth(cls: UmlClass): number {
    if (cls.elementType === 'DECISION' || cls.elementType === 'ASSOCIATION_CLASS') return 140;
    if (cls.elementType === 'NOTE') return 200;
    if (cls.elementType === 'ACTOR') return 100;
    if (cls.elementType === 'LIFELINE') return 140;

    let maxChars = cls.name ? cls.name.length : 12;
    if (cls.attributes) {
      for (const a of cls.attributes) {
        const len = (a.name?.length || 0) + (a.type?.length || 0) + (a.isPrimaryKey ? 10 : 5);
        if (len > maxChars) maxChars = len;
      }
    }
    if (cls.methods) {
      for (const m of cls.methods) {
        const len = (m.name?.length || 0) + (m.returnType?.length || 0) + 8;
        if (len > maxChars) maxChars = len;
      }
    }
    const estimated = maxChars * 7.5 + 40;
    return Math.max(cls.width || 220, Math.round(estimated));
  }

  getClassHeight(cls: UmlClass): number {
    if (cls.elementType === 'DECISION' || cls.elementType === 'ASSOCIATION_CLASS') return 100;
    if (cls.elementType === 'NOTE') return 120;
    if (cls.elementType === 'ACTOR') return 110;
    if (cls.elementType === 'LIFELINE') return 280;

    const attrCount = (cls.attributes && cls.attributes.length > 0) ? cls.attributes.length : 1;
    const methCount = (cls.methods && cls.methods.length > 0) ? cls.methods.length : 1;
    // 56px cabecera + atributos (16px c/u) + divisor y espacio (22px) + métodos (16px c/u) + 20px padding inferior
    const minRequired = 56 + (attrCount * 16) + 22 + (methCount * 16) + 20;
    return Math.max(cls.height || 180, minRequired);
  }

  // --- CÁLCULO DE RUTAS GEOMÉTRICAS (SVG) ---

  getRelationPath(rel: UmlRelation): { path: string; labelX: number; labelY: number; srcX: number; srcY: number; tgtX: number; tgtY: number } {
    const src = this.diagram().classes.find(c => c.id === rel.sourceClassId);
    const tgt = this.diagram().classes.find(c => c.id === rel.targetClassId);

    if (!src || !tgt) {
      return { path: '', labelX: 0, labelY: 0, srcX: 0, srcY: 0, tgtX: 0, tgtY: 0 };
    }

    const srcW = this.getClassWidth(src);
    const srcH = this.getClassHeight(src);
    const tgtW = this.getClassWidth(tgt);
    const tgtH = this.getClassHeight(tgt);

    const srcCenter = { x: src.position.x + srcW / 2, y: src.position.y + srcH / 2 };
    const tgtCenter = { x: tgt.position.x + tgtW / 2, y: tgt.position.y + tgtH / 2 };

    let p1 = { x: srcCenter.x, y: srcCenter.y };
    let p2 = { x: tgtCenter.x, y: tgtCenter.y };

    if (Math.abs(srcCenter.x - tgtCenter.x) > Math.abs(srcCenter.y - tgtCenter.y)) {
      if (srcCenter.x < tgtCenter.x) {
        p1 = { x: src.position.x + srcW, y: srcCenter.y };
        p2 = { x: tgt.position.x, y: tgtCenter.y };
      } else {
        p1 = { x: src.position.x, y: srcCenter.y };
        p2 = { x: tgt.position.x + tgtW, y: tgtCenter.y };
      }
    } else {
      if (srcCenter.y < tgtCenter.y) {
        p1 = { x: srcCenter.x, y: src.position.y + srcH };
        p2 = { x: tgtCenter.x, y: tgt.position.y };
      } else {
        p1 = { x: srcCenter.x, y: src.position.y };
        p2 = { x: tgtCenter.x, y: tgt.position.y + tgtH };
      }
    }

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const path = `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;

    return {
      path,
      labelX: midX,
      labelY: midY - 12,
      srcX: p1.x,
      srcY: p1.y,
      tgtX: p2.x,
      tgtY: p2.y
    };
  }

  // --- IMPORTACIÓN Y EXPORTACIÓN XMI (ENTERPRISE ARCHITECT) ---

  triggerImportXmi() {
    this.xmiFileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlContent = e.target?.result as string;
        const importedDiagram = this.xmiService.importFromXmi(xmlContent);
        this.diagram.set(importedDiagram);
        this.selectedClassId.set(null);
        this.resetView();
        this.notify(`¡Éxito! Se importaron ${importedDiagram.classes.length} clases y ${importedDiagram.relations.length} relaciones.`);
      } catch (err: any) {
        alert('Error al importar XMI: ' + err.message);
      } finally {
        target.value = '';
      }
    };
    reader.readAsText(file);
  }

  exportarXmi() {
    try {
      const xmiXml = this.xmiService.exportToXmi(this.diagram());
      const blob = new Blob([xmiXml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.diagram().name.replace(/\s+/g, '_')}_EA.xmi`;
      a.click();
      URL.revokeObjectURL(url);
      this.notify('Archivo XMI descargado exitosamente para Enterprise Architect.');
    } catch (e: any) {
      alert('Error al exportar XMI: ' + e.message);
    }
  }

  // --- VISOR Y VALIDADOR XMI EN VIVO ---

  abrirVisorXmi() {
    const xml = this.xmiService.exportToXmi(this.diagram());
    this.generatedXmi.set(xml);
    const report = this.xmiService.validateXmi(xml);
    this.validationReport.set(report);
    this.showXmiModal.set(true);
  }

  cerrarVisorXmi() {
    this.showXmiModal.set(false);
  }

  copiarXmiAlPortapapeles() {
    copyToClipboard(this.generatedXmi());
    this.notify('Código XMI 2.1 copiado al portapapeles.');
  }

  cargarXmiEjemploOficial() {
    const xmlEjemplo = this.xmiService.exportToXmi(this.diagram());
    try {
      const diag = this.xmiService.importFromXmi(xmlEjemplo);
      this.diagram.set(diag);
      this.notify('Simulación de Importación XMI completada sin errores.');
      this.cerrarVisorXmi();
    } catch (e: any) {
      alert('Fallo de validación: ' + e.message);
    }
  }

  // --- GENERADOR DDL POSTGRESQL ---

  abrirModalDdl() {
    const ddl = this.xmiService.generatePostgreSqlDdl(this.diagram());
    this.generatedDdl.set(ddl);
    this.showDdlModal.set(true);
  }

  cerrarModalDdl() {
    this.showDdlModal.set(false);
  }

  descargarScriptSql() {
    const blob = new Blob([this.generatedDdl()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_postgresql_${Date.now()}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    this.notify('Script schema.sql descargado.');
  }

  copiarDdlAlPortapapeles() {
    copyToClipboard(this.generatedDdl());
    this.notify('Script SQL copiado al portapapeles.');
  }

  // --- PERSISTENCIA Y MODELOS CONCEPTUALES AISLADOS POR PROYECTO ---

  setDiagramName(name: string): void {
    const clean = (name || '').trim() || 'Proyecto UML Sin Título';
    this.diagram.update(d => ({
      ...d,
      name: clean,
      updatedAt: new Date().toISOString()
    }));
    const projId = this.projectService.activeProjectId();
    if (projId) {
      this.projectService.updateProjectName(projId, clean);
    }
    this.saveCurrentProjectDiagram();
    this.collabSocket.emitDiagramChange(this.diagram(), `Renombró proyecto a "${clean}"`);
    this.notify(`Nombre del proyecto actualizado a: "${clean}"`);
  }

  getProjectDisplayName(proj: ProjectSummary): string {
    if (!proj) return 'Proyecto';

    // 1. Prioridad Máxima: Diagrama editado y guardado en memoria por el usuario
    try {
      const raw = localStorage.getItem('case_diagram_' + proj.id);
      if (raw) {
        const diag = JSON.parse(raw);
        if (diag.name && typeof diag.name === 'string' && diag.name.trim()) {
          const diagClean = diag.name.trim();
          if (diagClean.toLowerCase() !== 'proyecto' && diagClean !== 'Nuevo Proyecto UML') {
            return diagClean;
          }
        }
      }
    } catch (e) {}

    // 2. Nombre del proyecto si es distinto a los nombres por defecto
    if (proj.name && proj.name.trim()) {
      const clean = proj.name.trim();
      if (clean.toLowerCase() !== 'proyecto' && clean !== 'Nuevo Proyecto UML') {
        return clean;
      }
    }

    // 3. Cualquier nombre presente en el diagrama guardado
    try {
      const raw = localStorage.getItem('case_diagram_' + proj.id);
      if (raw) {
        const diag = JSON.parse(raw);
        if (diag.name && typeof diag.name === 'string' && diag.name.trim()) {
          return diag.name.trim();
        }
      }
    } catch (e) {}

    if (proj.name && proj.name.trim()) {
      return proj.name.trim();
    }

    return 'Proyecto de ' + (this.getOwnerName(proj.ownerId) || 'Modelado');
  }

  saveCurrentProjectDiagram() {
    const projId = this.projectService.activeProjectId();
    if (!projId) return;
    const cur = this.diagram();
    try {
      localStorage.setItem('case_diagram_' + projId, JSON.stringify(cur));
    } catch (e) {
      console.error('Error persistiendo diagrama:', e);
    }
    this.projectService.updateProjectCounters(projId, cur.classes.length, cur.relations.length, cur.name);
  }

  loadProjectDiagram(projectId: string): UmlDiagram {
    try {
      const raw = localStorage.getItem('case_diagram_' + projectId);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error cargando diagrama de proyecto:', e);
    }

    if (projectId === 'proj_salud_2026') {
      return this.obtenerDiagramaSalud();
    } else if (projectId === 'proj_ecommerce_2026') {
      return this.obtenerDiagramaEcommerce();
    } else if (projectId === 'proj_laboratorio_2026') {
      return this.obtenerDiagramaLaboratorio();
    } else if (projectId === 'proj_farmacia_2026') {
      return this.obtenerDiagramaFarmacia();
    }

    const proj = this.projectService.projects().find(p => p.id === projectId);
    return {
      id: 'diag_' + projectId,
      name: proj?.name || 'Nuevo Modelo UML',
      description: proj?.description || 'Diagrama conceptual para bases de datos relacionales.',
      classes: [],
      relations: [],
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  obtenerDiagramaSalud(): UmlDiagram {
    const exampleClasses: UmlClass[] = [
      {
        id: 'cls_paciente',
        name: 'Paciente',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 190,
        position: { x: 80, y: 80 },
        attributes: [
          { id: 'a1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'a2', name: 'nombreCompleto', type: 'String', visibility: '+' },
          { id: 'a3', name: 'ciDni', type: 'String', visibility: '+' },
          { id: 'a4', name: 'fechaNacimiento', type: 'LocalDate', visibility: '+' },
          { id: 'a5', name: 'telefono', type: 'String', visibility: '+' }
        ],
        methods: [
          { id: 'm1', name: 'obtenerEdad', returnType: 'Integer', visibility: '+' }
        ]
      },
      {
        id: 'cls_historial',
        name: 'HistoriaClinica',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 230,
        height: 190,
        position: { x: 420, y: 80 },
        attributes: [
          { id: 'a6', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'a7', name: 'codigoRegistro', type: 'String', visibility: '+' },
          { id: 'a8', name: 'diagnostico', type: 'Text', visibility: '+' },
          { id: 'a9', name: 'tratamiento', type: 'Text', visibility: '+' },
          { id: 'a10', name: 'fechaRegistro', type: 'LocalDateTime', visibility: '+' }
        ],
        methods: [
          { id: 'm2', name: 'agregarDiagnostico', returnType: 'void', visibility: '+' }
        ]
      },
      {
        id: 'cls_medico',
        name: 'Medico',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 190,
        position: { x: 420, y: 380 },
        attributes: [
          { id: 'a11', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'a12', name: 'nombre', type: 'String', visibility: '+' },
          { id: 'a13', name: 'especialidad', type: 'String', visibility: '+' },
          { id: 'a14', name: 'matriculaProf', type: 'String', visibility: '+' },
          { id: 'a15', name: 'consultorio', type: 'String', visibility: '+' }
        ],
        methods: [
          { id: 'm3', name: 'verificarDisponibilidad', returnType: 'Boolean', visibility: '+' }
        ]
      },
      {
        id: 'cls_cita',
        name: 'CitaMedica',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 190,
        position: { x: 80, y: 380 },
        attributes: [
          { id: 'a16', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'a17', name: 'fechaHora', type: 'LocalDateTime', visibility: '+' },
          { id: 'a18', name: 'estado', type: 'String', visibility: '+' },
          { id: 'a19', name: 'motivoConsulta', type: 'String', visibility: '+' },
          { id: 'a20', name: 'montoConsulta', type: 'BigDecimal', visibility: '+' }
        ],
        methods: [
          { id: 'm4', name: 'confirmarAsistencia', returnType: 'void', visibility: '+' }
        ]
      },
      {
        id: 'cls_rombo_triaje',
        name: '¿Urgencia?',
        elementType: 'DECISION',
        stereotype: '<<decisión>>',
        width: 140,
        height: 100,
        position: { x: 260, y: 260 },
        attributes: [],
        methods: []
      }
    ];

    const exampleRelations: UmlRelation[] = [
      {
        id: 'r1',
        sourceClassId: 'cls_paciente',
        targetClassId: 'cls_historial',
        type: 'COMPOSITION',
        name: 'posee',
        sourceMultiplicity: '1',
        targetMultiplicity: '1'
      },
      {
        id: 'r2',
        sourceClassId: 'cls_paciente',
        targetClassId: 'cls_cita',
        type: 'ONE_TO_MANY',
        name: 'solicita',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*'
      },
      {
        id: 'r3',
        sourceClassId: 'cls_medico',
        targetClassId: 'cls_cita',
        type: 'ONE_TO_MANY',
        name: 'atiende',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*'
      }
    ];

    return {
      id: 'diag_salud',
      name: 'Sistema de Salud - Historias Clínicas',
      description: 'Modelo conceptual para gestión de pacientes, citas y médicos',
      classes: exampleClasses,
      relations: exampleRelations,
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  obtenerDiagramaEcommerce(): UmlDiagram {
    const classes: UmlClass[] = [
      {
        id: 'cls_cliente',
        name: 'Cliente',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 180,
        position: { x: 80, y: 80 },
        attributes: [
          { id: 'ec_a1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'ec_a2', name: 'razonSocial', type: 'String', visibility: '+' },
          { id: 'ec_a3', name: 'rucNit', type: 'String', visibility: '+' },
          { id: 'ec_a4', name: 'direccion', type: 'String', visibility: '+' }
        ],
        methods: [{ id: 'ec_m1', name: 'validarLimiteCredito', returnType: 'Boolean', visibility: '+' }]
      },
      {
        id: 'cls_pedido',
        name: 'Pedido',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 180,
        position: { x: 380, y: 80 },
        attributes: [
          { id: 'ec_a5', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'ec_a6', name: 'numeroPedido', type: 'String', visibility: '+' },
          { id: 'ec_a7', name: 'fecha', type: 'LocalDate', visibility: '+' },
          { id: 'ec_a8', name: 'montoTotal', type: 'BigDecimal', visibility: '+' }
        ],
        methods: [{ id: 'ec_m2', name: 'calcularImpuestos', returnType: 'BigDecimal', visibility: '+' }]
      },
      {
        id: 'cls_producto',
        name: 'Producto',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 180,
        position: { x: 80, y: 360 },
        attributes: [
          { id: 'ec_a9', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'ec_a10', name: 'codigoSku', type: 'String', visibility: '+' },
          { id: 'ec_a11', name: 'descripcion', type: 'String', visibility: '+' },
          { id: 'ec_a12', name: 'precioUnitario', type: 'BigDecimal', visibility: '+' },
          { id: 'ec_a13', name: 'stock', type: 'Integer', visibility: '+' }
        ],
        methods: [{ id: 'ec_m3', name: 'actualizarStock', returnType: 'void', visibility: '+' }]
      },
      {
        id: 'cls_item',
        name: 'ItemPedido',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 210,
        height: 160,
        position: { x: 380, y: 360 },
        attributes: [
          { id: 'ec_a14', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'ec_a15', name: 'cantidad', type: 'Integer', visibility: '+' },
          { id: 'ec_a16', name: 'precioUnitario', type: 'BigDecimal', visibility: '+' }
        ],
        methods: []
      },
      {
        id: 'cls_factura',
        name: 'FacturaFiscal',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 160,
        position: { x: 670, y: 80 },
        attributes: [
          { id: 'ec_a17', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'ec_a18', name: 'numeroFactura', type: 'String', visibility: '+' },
          { id: 'ec_a19', name: 'fechaEmision', type: 'LocalDateTime', visibility: '+' }
        ],
        methods: [{ id: 'ec_m4', name: 'emitirComprobante', returnType: 'void', visibility: '+' }]
      }
    ];

    const relations: UmlRelation[] = [
      { id: 'ec_r1', sourceClassId: 'cls_cliente', targetClassId: 'cls_pedido', type: 'ONE_TO_MANY', name: 'realiza', sourceMultiplicity: '1', targetMultiplicity: '0..*' },
      { id: 'ec_r2', sourceClassId: 'cls_pedido', targetClassId: 'cls_item', type: 'COMPOSITION', name: 'contiene', sourceMultiplicity: '1', targetMultiplicity: '1..*' },
      { id: 'ec_r3', sourceClassId: 'cls_producto', targetClassId: 'cls_item', type: 'ONE_TO_MANY', name: 'detalla', sourceMultiplicity: '1', targetMultiplicity: '0..*' },
      { id: 'ec_r4', sourceClassId: 'cls_pedido', targetClassId: 'cls_factura', type: 'ONE_TO_ONE', name: 'genera', sourceMultiplicity: '1', targetMultiplicity: '1' }
    ];

    return {
      id: 'diag_ecommerce',
      name: 'Plataforma de Facturación y Pedidos',
      description: 'Diagrama de clases para el módulo de pagos y comprobantes fiscales',
      classes,
      relations,
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  obtenerDiagramaLaboratorio(): UmlDiagram {
    const classes: UmlClass[] = [
      {
        id: 'cls_muestra',
        name: 'MuestraBiologica',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 180,
        position: { x: 80, y: 120 },
        attributes: [
          { id: 'lab_a1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'lab_a2', name: 'codigoTubo', type: 'String', visibility: '+' },
          { id: 'lab_a3', name: 'tipoMuestra', type: 'String', visibility: '+' },
          { id: 'lab_a4', name: 'fechaToma', type: 'LocalDateTime', visibility: '+' }
        ],
        methods: [{ id: 'lab_m1', name: 'validarIntegridad', returnType: 'Boolean', visibility: '+' }]
      },
      {
        id: 'cls_analisis',
        name: 'AnalisisClinico',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 180,
        position: { x: 380, y: 120 },
        attributes: [
          { id: 'lab_a5', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'lab_a6', name: 'nombreEstudio', type: 'String', visibility: '+' },
          { id: 'lab_a7', name: 'costoArancel', type: 'BigDecimal', visibility: '+' }
        ],
        methods: []
      },
      {
        id: 'cls_resultado',
        name: 'ResultadoLaboratorio',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 230,
        height: 180,
        position: { x: 230, y: 380 },
        attributes: [
          { id: 'lab_a8', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'lab_a9', name: 'valorMedido', type: 'String', visibility: '+' },
          { id: 'lab_a10', name: 'rangoReferencial', type: 'String', visibility: '+' },
          { id: 'lab_a11', name: 'observaciones', type: 'Text', visibility: '+' }
        ],
        methods: [{ id: 'lab_m2', name: 'firmarBioquimico', returnType: 'void', visibility: '+' }]
      }
    ];

    const relations: UmlRelation[] = [
      { id: 'lab_r1', sourceClassId: 'cls_muestra', targetClassId: 'cls_resultado', type: 'ONE_TO_MANY', name: 'produce', sourceMultiplicity: '1', targetMultiplicity: '1..*' },
      { id: 'lab_r2', sourceClassId: 'cls_analisis', targetClassId: 'cls_resultado', type: 'ONE_TO_MANY', name: 'evalua', sourceMultiplicity: '1', targetMultiplicity: '0..*' }
    ];

    return {
      id: 'diag_laboratorio',
      name: 'Gestión de Laboratorio Clínico y Muestras',
      description: 'Modelo de entidades UML para análisis de sangre, reactivos y resultados',
      classes,
      relations,
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  obtenerDiagramaFarmacia(): UmlDiagram {
    const classes: UmlClass[] = [
      {
        id: 'cls_medicamento',
        name: 'Medicamento',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 180,
        position: { x: 80, y: 80 },
        attributes: [
          { id: 'far_a1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'far_a2', name: 'nombreComercial', type: 'String', visibility: '+' },
          { id: 'far_a3', name: 'principioActivo', type: 'String', visibility: '+' },
          { id: 'far_a4', name: 'presentacion', type: 'String', visibility: '+' }
        ],
        methods: [{ id: 'far_m1', name: 'verificarReceta', returnType: 'Boolean', visibility: '+' }]
      },
      {
        id: 'cls_lote',
        name: 'LoteMedicamento',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 180,
        position: { x: 380, y: 80 },
        attributes: [
          { id: 'far_a5', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'far_a6', name: 'numeroLote', type: 'String', visibility: '+' },
          { id: 'far_a7', name: 'fechaVencimiento', type: 'LocalDate', visibility: '+' },
          { id: 'far_a8', name: 'stockDisponible', type: 'Integer', visibility: '+' }
        ],
        methods: [{ id: 'far_m2', name: 'estaVencido', returnType: 'Boolean', visibility: '+' }]
      },
      {
        id: 'cls_proveedor',
        name: 'ProveedorFarmacia',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 160,
        position: { x: 670, y: 80 },
        attributes: [
          { id: 'far_a9', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'far_a10', name: 'razonSocial', type: 'String', visibility: '+' },
          { id: 'far_a11', name: 'contacto', type: 'String', visibility: '+' }
        ],
        methods: []
      },
      {
        id: 'cls_dispensacion',
        name: 'DispensacionVenta',
        elementType: 'CLASS',
        stereotype: '<<entity>>',
        width: 220,
        height: 160,
        position: { x: 380, y: 360 },
        attributes: [
          { id: 'far_a12', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true },
          { id: 'far_a13', name: 'fechaHora', type: 'LocalDateTime', visibility: '+' },
          { id: 'far_a14', name: 'cantidadUnidades', type: 'Integer', visibility: '+' }
        ],
        methods: [{ id: 'far_m3', name: 'registrarSalida', returnType: 'void', visibility: '+' }]
      }
    ];

    const relations: UmlRelation[] = [
      { id: 'far_r1', sourceClassId: 'cls_medicamento', targetClassId: 'cls_lote', type: 'ONE_TO_MANY', name: 'distribuidoEn', sourceMultiplicity: '1', targetMultiplicity: '0..*' },
      { id: 'far_r2', sourceClassId: 'cls_proveedor', targetClassId: 'cls_lote', type: 'ONE_TO_MANY', name: 'suministra', sourceMultiplicity: '1', targetMultiplicity: '0..*' },
      { id: 'far_r3', sourceClassId: 'cls_lote', targetClassId: 'cls_dispensacion', type: 'ONE_TO_MANY', name: 'despacha', sourceMultiplicity: '1', targetMultiplicity: '0..*' }
    ];

    return {
      id: 'diag_farmacia',
      name: 'Inventario y Dispensación Farmacéutica',
      description: 'Control de stocks de medicamentos, lotes y prescripciones médicas',
      classes,
      relations,
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  cargarEjemploHospital() {
    const diag = this.obtenerDiagramaSalud();
    this.diagram.set(diag);
    this.saveCurrentProjectDiagram();
    this.notify('Modelo cargado con Clases, Entidades y Rombo de Decisión.');
  }

  // --- COMANDOS DE VOZ Y DIGITALIZACIÓN DE IMÁGENES / CAPTURAS CON IA ---

  abrirModalVision() {
    this.showVisionModal.set(true);
  }

  cerrarModalVision() {
    this.showVisionModal.set(false);
  }

  saveHistorySnapshot() {
    try {
      const snap = JSON.stringify(this.diagram());
      this.historyStack.push(snap);
      if (this.historyStack.length > 40) {
        this.historyStack.shift();
      }
      this.canUndo.set(this.historyStack.length > 0);
      // Al realizar una nueva acción, se resetea la pila de rehacer
      this.redoStack = [];
      this.canRedo.set(false);
    } catch (e) {
      console.error('Error al guardar snapshot para deshacer:', e);
    }
  }

  deshacer() {
    if (this.historyStack.length > 0) {
      // Guardar el estado actual en la pila de rehacer antes de restaurar el previo
      try {
        this.redoStack.push(JSON.stringify(this.diagram()));
        this.canRedo.set(true);
      } catch (e) {
        console.error(e);
      }

      const prev = this.historyStack.pop();
      this.canUndo.set(this.historyStack.length > 0);
      if (prev) {
        try {
          const parsed: UmlDiagram = JSON.parse(prev);
          this.diagram.set(parsed);
          this.selectedClassId.set(null);
          this.selectedRelationId.set(null);
          this.notify('Acción deshecha (Deshacer).');
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      this.notify('No hay acciones previas para deshacer.');
    }
  }

  rehacer() {
    if (this.redoStack.length > 0) {
      // Guardar el estado actual en la pila de deshacer antes de avanzar
      try {
        this.historyStack.push(JSON.stringify(this.diagram()));
        this.canUndo.set(true);
      } catch (e) {
        console.error(e);
      }

      const next = this.redoStack.pop();
      this.canRedo.set(this.redoStack.length > 0);
      if (next) {
        try {
          const parsed: UmlDiagram = JSON.parse(next);
          this.diagram.set(parsed);
          this.selectedClassId.set(null);
          this.selectedRelationId.set(null);
          this.notify('Acción restaurada (Rehacer).');
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      this.notify('No hay acciones para rehacer.');
    }
  }

  findClassByName(searchName?: string, expectedType?: UmlElementType): UmlClass | undefined {
    if (!searchName) return undefined;
    const cleanKey = searchName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    return this.diagram().classes.find(c => {
      const classKey = c.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

      const matches = classKey === cleanKey;
      if (!matches) return false;
      if (expectedType) return c.elementType === expectedType;
      return true;
    });
  }

  findNoteToUpdate(targetIdentifier?: string): UmlClass | undefined {
    const allNotes = this.diagram().classes.filter(c => c.elementType === 'NOTE');
    if (allNotes.length === 0) return undefined;

    // Si el usuario especificó número como "1", "2"
    if (targetIdentifier && /^\d+$/.test(targetIdentifier)) {
      const idx = parseInt(targetIdentifier, 10) - 1;
      if (idx >= 0 && idx < allNotes.length) {
        return allNotes[idx];
      }
    }

    // Si hay una nota seleccionada actualmente en pantalla
    const selected = this.selectedClass();
    if (selected && selected.elementType === 'NOTE') {
      return selected;
    }

    // Por defecto, la última nota creada
    return allNotes[allNotes.length - 1];
  }

  renombrarElemento(oldName: string, newName: string, expectedType?: UmlElementType): boolean {
    const cls = this.findClassByName(oldName, expectedType);
    if (!cls) return false;
    this.saveHistorySnapshot();
    const prevName = cls.name;
    cls.name = newName;
    this.touchDiagram();
    this.notify(`Elemento "${prevName}" renombrado a "${newName}".`);
    return true;
  }

  crearRelacionEntre(
    sourceName: string, 
    targetName: string, 
    relType: UmlRelationType = 'ONE_TO_MANY',
    sourceMultiplicity?: string,
    targetMultiplicity?: string
  ): boolean {
    const src = this.findClassByName(sourceName);
    const tgt = this.findClassByName(targetName);
    if (!src || !tgt || src.id === tgt.id) return false;

    let defaultSourceMult = '1';
    let defaultTargetMult = '0..*';

    if (relType === 'MANY_TO_MANY') {
      defaultSourceMult = '*';
      defaultTargetMult = '*';
    } else if (relType === 'MANY_TO_ONE') {
      defaultSourceMult = '*';
      defaultTargetMult = '1';
    } else if (relType === 'ONE_TO_ONE') {
      defaultSourceMult = '1';
      defaultTargetMult = '1';
    } else if (relType === 'INHERITANCE') {
      defaultSourceMult = '';
      defaultTargetMult = '';
    } else if (relType === 'COMPOSITION') {
      defaultSourceMult = '1';
      defaultTargetMult = '1..*';
    } else if (relType === 'AGGREGATION') {
      defaultSourceMult = '1';
      defaultTargetMult = '0..*';
    }

    this.saveHistorySnapshot();
    const newRel: UmlRelation = {
      id: 'rel_' + Date.now(),
      sourceClassId: src.id,
      targetClassId: tgt.id,
      type: relType,
      sourceMultiplicity: sourceMultiplicity ?? defaultSourceMult,
      targetMultiplicity: targetMultiplicity ?? defaultTargetMult
    };

    this.diagram.update(d => ({
      ...d,
      relations: [...d.relations, newRel],
      updatedAt: new Date().toISOString()
    }));
    return true;
  }

  checkElementLockForVoice(elementId: string, elementName: string): boolean {
    if (this.collabSocket.isLockedByOther(elementId)) {
      const lockInfo = this.collabSocket.activeLocks().get(elementId);
      const editorName = lockInfo ? lockInfo.userName : 'otro colaborador';
      this.notify(`🔒 Bloqueado por Exclusión Mutua: "${elementName}" está siendo editada por ${editorName}.`);
      return true;
    }
    return false;
  }

  handleVoiceCommand(cmd: ParsedVoiceCommand) {
    const isMutatingCommand = !['EXPORT_XMI', 'VALIDATE_XMI', 'GENERATE_SQL'].includes(cmd.type);
    if (isMutatingCommand && this.isReadOnly()) {
      this.notify('🔒 Modo Solo Lectura: No tienes permisos para modificar este diagrama.');
      return;
    }

    switch (cmd.type) {
      case 'UNDO':
        this.deshacer();
        break;

      case 'REDO':
        this.rehacer();
        break;

      case 'CREATE_CLASS':
        if (cmd.elementName) {
          const existing = this.findClassByName(cmd.elementName);
          if (existing) {
            this.notify(`⚠️ La clase "${existing.name}" ya existe en el diagrama.`);
            this.voiceService.speak(`La clase ${existing.name} ya existe.`);
            break;
          }
        }
        this.saveHistorySnapshot();
        this.agregarElemento('CLASS', cmd.elementName);
        this.notify(`Voz: Clase "${cmd.elementName || 'nueva'}" creada.`);
        break;

      case 'CREATE_DECISION':
        if (cmd.elementName) {
          const existing = this.findClassByName(cmd.elementName, 'DECISION');
          if (existing) {
            this.notify(`⚠️ El rombo "${existing.name}" ya existe en el diagrama.`);
            break;
          }
        }
        this.saveHistorySnapshot();
        this.agregarElemento('DECISION', cmd.elementName);
        this.notify(`Voz: Rombo "${cmd.elementName || 'nuevo'}" creado.`);
        break;

      case 'CREATE_ACTOR':
        if (cmd.elementName) {
          const existing = this.findClassByName(cmd.elementName, 'ACTOR');
          if (existing) {
            this.notify(`⚠️ El actor "${existing.name}" ya existe en el diagrama.`);
            break;
          }
        }
        this.saveHistorySnapshot();
        this.agregarElemento('ACTOR', cmd.elementName);
        this.notify(`Voz: Actor "${cmd.elementName || 'nuevo'}" creado.`);
        break;

      case 'CREATE_INTERFACE':
        this.saveHistorySnapshot();
        this.agregarElemento('INTERFACE', cmd.elementName);
        this.notify(`Voz: Interfaz "${cmd.elementName}" creada.`);
        break;

      case 'CREATE_NOTE':
        this.saveHistorySnapshot();
        const note = this.agregarElemento('NOTE');
        if (cmd.noteText) {
          note.noteContent = cmd.noteText;
        } else {
          note.noteContent = 'Nota: Nueva nota de diseño.';
        }
        this.selectedClassId.set(note.id);
        this.touchDiagram();
        this.notify(`Voz: Nota creada y seleccionada en el lienzo.`);
        break;

      case 'UPDATE_NOTE':
        const noteToUpdate = this.findNoteToUpdate(cmd.noteTarget);
        if (noteToUpdate) {
          if (this.checkElementLockForVoice(noteToUpdate.id, 'Nota')) return;
          this.saveHistorySnapshot();
          noteToUpdate.noteContent = cmd.noteText || '';
          this.selectedClassId.set(noteToUpdate.id);
          this.touchDiagram();
          this.notify(`Voz: Nota actualizada: "${cmd.noteText}".`);
        } else {
          this.saveHistorySnapshot();
          const newN = this.agregarElemento('NOTE');
          newN.noteContent = cmd.noteText || '';
          this.selectedClassId.set(newN.id);
          this.touchDiagram();
          this.notify(`Voz: Nota creada con el texto especificado.`);
        }
        break;

      case 'RENAME_CLASS':
        if (cmd.targetClassName && cmd.newElementName) {
          const cls = this.findClassByName(cmd.targetClassName, cmd.elementType);
          if (cls) {
            if (this.checkElementLockForVoice(cls.id, cls.name)) return;
            const ok = this.renombrarElemento(cmd.targetClassName, cmd.newElementName, cmd.elementType);
            if (!ok) {
              this.notify(`Voz: No se encontró "${cmd.targetClassName}" para renombrar.`);
            }
          } else {
            this.notify(`Voz: No se encontró "${cmd.targetClassName}" para renombrar.`);
          }
        }
        break;

      case 'ADD_ATTRIBUTE':
        const targetCls = cmd.targetClassName ? this.findClassByName(cmd.targetClassName) : this.selectedClass();
        if (targetCls) {
          if (this.checkElementLockForVoice(targetCls.id, targetCls.name)) return;
          const attrName = cmd.elementName || 'nuevoCampo';
          const existsAttr = targetCls.attributes.some(a => a.name.toLowerCase() === attrName.toLowerCase());
          if (existsAttr) {
            this.notify(`⚠️ El atributo "${attrName}" ya existe en la clase ${targetCls.name}.`);
            break;
          }
          this.saveHistorySnapshot();
          targetCls.attributes.push({
            id: 'attr_' + Date.now(),
            name: attrName,
            type: cmd.dataType || 'String',
            visibility: '+',
            isPrimaryKey: !!cmd.isPrimaryKey,
            isNullable: true
          });
          this.touchDiagram();
          this.notify(`Voz: Atributo "${attrName}" (${cmd.dataType || 'String'}) agregado a ${targetCls.name}.`);
        } else {
          this.notify(`Voz: No se encontró la clase "${cmd.targetClassName}".`);
        }
        break;

      case 'ADD_METHOD':
        const targetClsM = cmd.targetClassName ? this.findClassByName(cmd.targetClassName) : this.selectedClass();
        if (targetClsM) {
          if (this.checkElementLockForVoice(targetClsM.id, targetClsM.name)) return;
          this.saveHistorySnapshot();
          if (!targetClsM.methods) {
            targetClsM.methods = [];
          }
          const cleanMethodName = (cmd.elementName || 'nuevaOperacion').replace(/[()]/g, '').trim();
          targetClsM.methods.push({
            id: 'm_' + Date.now(),
            name: cleanMethodName,
            returnType: cmd.returnType || 'void',
            visibility: '+'
          });
          this.touchDiagram();
          this.notify(`Voz: Método "${cleanMethodName}()" (${cmd.returnType || 'void'}) agregado a ${targetClsM.name}.`);
        } else {
          this.notify(`Voz: No se encontró la clase "${cmd.targetClassName || 'seleccionada'}".`);
        }
        break;

      case 'DELETE_METHOD':
        const targetClsDelM = cmd.targetClassName ? this.findClassByName(cmd.targetClassName) : this.selectedClass();
        if (targetClsDelM && targetClsDelM.methods) {
          if (this.checkElementLockForVoice(targetClsDelM.id, targetClsDelM.name)) return;
          const cleanMethodName = (cmd.elementName || '').replace(/[()]/g, '').trim().toLowerCase();
          const prevLen = targetClsDelM.methods.length;
          targetClsDelM.methods = targetClsDelM.methods.filter(m => m.name.toLowerCase() !== cleanMethodName);
          if (targetClsDelM.methods.length < prevLen) {
            this.saveHistorySnapshot();
            this.touchDiagram();
            this.notify(`Voz: Método "${cmd.elementName}()" eliminado de ${targetClsDelM.name}.`);
          } else {
            this.notify(`Voz: No se encontró el método "${cmd.elementName}()" en ${targetClsDelM.name}.`);
          }
        }
        break;

      case 'CONNECT_CLASSES':
        if (cmd.sourceClassName && cmd.targetClassName) {
          const src = this.findClassByName(cmd.sourceClassName);
          const tgt = this.findClassByName(cmd.targetClassName);
          if (src && this.checkElementLockForVoice(src.id, src.name)) return;
          if (tgt && this.checkElementLockForVoice(tgt.id, tgt.name)) return;
          const ok = this.crearRelacionEntre(
            cmd.sourceClassName, 
            cmd.targetClassName, 
            cmd.relationType,
            cmd.sourceMultiplicity,
            cmd.targetMultiplicity
          );
          if (ok) {
            this.notify(`Voz: Relación creada entre ${cmd.sourceClassName} y ${cmd.targetClassName}.`);
          } else {
            this.notify(`Voz: No se encontraron las clases "${cmd.sourceClassName}" o "${cmd.targetClassName}" para relacionar.`);
          }
        }
        break;

      case 'DELETE_CLASS':
        if (cmd.targetClassName) {
          const cls = this.findClassByName(cmd.targetClassName, cmd.elementType);
          if (cls) {
            if (this.checkElementLockForVoice(cls.id, cls.name)) return;
            this.saveHistorySnapshot();
            this.eliminarClase(cls.id);
            this.notify(`Voz: Elemento "${cls.name}" eliminado.`);
          } else {
            this.notify(`Voz: No se encontró el elemento "${cmd.targetClassName}" para eliminar.`);
          }
        }
        break;

      case 'EXPORT_XMI':
        this.exportarXmi();
        break;

      case 'VALIDATE_XMI':
        this.abrirVisorXmi();
        break;

      case 'GENERATE_SQL':
        this.abrirModalDdl();
        break;

      case 'CLEAR_CANVAS':
        this.saveHistorySnapshot();
        this.limpiarLienzo();
        break;

      case 'ZOOM_IN':
        this.setZoom(this.zoom() + 0.15);
        break;

      case 'ZOOM_OUT':
        this.setZoom(this.zoom() - 0.15);
        break;

      case 'RESET_VIEW':
        this.resetView();
        break;
    }
  }

  handleVisionDiagram(result: VisionScanResult) {
    if (!result.classes || result.classes.length === 0) {
      this.notify('No se identificaron clases en la imagen.');
      return;
    }

    this.saveHistorySnapshot();

    // Si ya existen clases en el lienzo, desplazar las nuevas verticalmente para no encimarlas
    const existing = this.diagram().classes;
    const maxY = existing.length > 0 ? Math.max(...existing.map(c => c.position.y + (c.height || 180))) + 60 : 80;

    const positionedClasses = result.classes.map(c => ({
      ...c,
      position: {
        x: c.position.x,
        y: existing.length > 0 ? c.position.y + maxY - 80 : c.position.y
      }
    }));

    this.diagram.update(d => ({
      ...d,
      classes: [...d.classes, ...positionedClasses],
      relations: [...d.relations, ...result.relations],
      updatedAt: new Date().toISOString()
    }));
    this.saveCurrentProjectDiagram();
    this.collabSocket.emitDiagramChange(this.diagram(), `Digitalizó foto (+${result.classes.length} clases)`);

    this.notify(`Imagen digitalizada con éxito: +${result.classes.length} clases y +${result.relations.length} relaciones.`);
  }

  touchDiagram() {
    if (this.isReadOnly()) {
      this.notify('🔒 Modo Solo Lectura: No tienes permisos para modificar este elemento.');
      return;
    }
    this.diagram.update(d => ({ ...d, updatedAt: new Date().toISOString() }));
    this.saveCurrentProjectDiagram();
    this.collabSocket.emitDiagramChange(this.diagram(), 'Modificó estructura o atributos');
  }

  public notify(msg: string) {
    this.notificationMessage.set(msg);
    setTimeout(() => {
      if (this.notificationMessage() === msg) {
        this.notificationMessage.set('');
      }
    }, 4000);
  }

  limpiarLienzo() {
    if (this.isReadOnly()) {
      this.notify('🔒 Modo Solo Lectura: No tienes permiso para limpiar el lienzo.');
      return;
    }
    this.saveHistorySnapshot();
    this.diagram.update(d => ({
      ...d,
      classes: [],
      relations: [],
      updatedAt: new Date().toISOString()
    }));
    this.selectedClassId.set(null);
    this.selectedRelationId.set(null);
    this.saveCurrentProjectDiagram();
    this.collabSocket.emitDiagramChange(this.diagram(), 'Limpió todo el lienzo');
    this.notify('Lienzo vaciado por completo.');
  }

  iniciarSesion() {
    this.loginError.set('');
    const res = this.authService.login(this.loginUsername(), this.loginPassword());
    if (!res.success) {
      this.loginError.set(res.message);
      return;
    }
    if (res.user?.debeCambiarPassword) {
      return;
    }
    this.currentView.set('DASHBOARD');
  }

  quickSwitchUser(userKey: 'carlos' | 'laura' | 'pedro' | 'admin') {
    const pass = userKey === 'admin' ? 'admin' : 'empresa2026';
    this.loginUsername.set(userKey);
    this.loginPassword.set(pass);
    this.iniciarSesion();
  }

  guardarNuevaPasswordForzada() {
    this.loginError.set('');
    if (this.changePassNew() !== this.changePassConfirm()) {
      this.loginError.set('Las contraseñas no coinciden.');
      return;
    }
    const res = this.authService.changePassword(this.changePassCurrent(), this.changePassNew());
    if (!res.success) {
      this.loginError.set(res.message);
    } else {
      this.currentView.set('DASHBOARD');
      this.notify('Contraseña actualizada con éxito.');
    }
  }

  abrirProyecto(projectId: string) {
    this.deseleccionarElemento();
    if (this.projectService.activeProjectId() && this.projectService.activeProjectId() !== projectId) {
      this.saveCurrentProjectDiagram();
    }
    this.projectService.selectProject(projectId);
    this.collabSocket.joinProjectRoom(projectId);

    const loaded = this.loadProjectDiagram(projectId);
    this.diagram.set(loaded);
    this.saveCurrentProjectDiagram();

    this.currentView.set('WORKSPACE');
    if (typeof window !== 'undefined' && window.history) {
      const url = new URL(window.location.href);
      url.searchParams.set('project', projectId);
      window.history.replaceState({}, '', url.toString());
    }
    this.notify(`Abierto: ${this.diagram().name}`);
  }

  volverAlDashboard() {
    this.deseleccionarElemento();
    this.saveCurrentProjectDiagram();
    this.collabSocket.leaveProjectRoom();
    this.currentView.set('DASHBOARD');
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, '', '/');
    }
  }

  cerrarSesion() {
    this.deseleccionarElemento();
    this.saveCurrentProjectDiagram();
    this.authService.logout();
    this.collabSocket.leaveProjectRoom();
    this.currentView.set('LOGIN');
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, '', '/');
    }
  }

  crearNuevoProyectoDesdeDashboard() {
    const name = this.newProjectName().trim();
    if (!name) return;
    const desc = this.newProjectDescription().trim() || 'Modelo conceptual UML 2.5';
    const newP = this.projectService.createProject(name, desc);
    this.showNewProjectModal.set(false);
    this.newProjectName.set('');
    this.newProjectDescription.set('');

    const emptyDiagram: UmlDiagram = {
      id: 'diag_' + newP.id,
      name: newP.name,
      description: newP.description,
      classes: [],
      relations: [],
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem('case_diagram_' + newP.id, JSON.stringify(emptyDiagram));
    } catch (e) {}

    this.abrirProyecto(newP.id);
  }

  crearUsuarioAdmin() {
    this.adminSuccessMsg.set('');
    this.adminErrorMsg.set('');
    const res = this.authService.createUser({
      username: this.adminNewUsername(),
      nombreCompleto: this.adminNewFullName(),
      password: this.adminNewInitialPassword()
    });
    if (res.success) {
      this.adminSuccessMsg.set(`Usuario "${this.adminNewFullName()}" creado con éxito.`);
      this.adminNewUsername.set('');
      this.adminNewFullName.set('');
      this.adminNewInitialPassword.set('empresa2026');
    } else {
      this.adminErrorMsg.set(res.message);
    }
  }

  copiarEnlaceProyecto(projectId?: string) {
    const pId = projectId || this.projectService.activeProjectId();
    const link = this.projectService.getShareableLink(pId);
    copyToClipboard(link);
    this.notify('¡Enlace protegido del proyecto copiado al portapapeles!');
  }

  cambiarPermisoColaborador(userId: string, perm: ProjectPermission) {
    const projId = this.projectService.activeProjectId();
    this.projectService.updateCollaboratorPermission(projId, userId, perm);
    this.collabSocket.emitPermissionChange(userId, perm);
    this.notify('Permiso de colaborador actualizado.');
  }

  enviarInvitacionColaborador() {
    const userId = this.selectedUserToAdd();
    const role = this.selectedRoleToAdd() === 'VIEWER' ? 'VIEWER' : 'EDITOR';
    if (!userId) {
      this.notify('⚠️ Selecciona un usuario para invitar.');
      return;
    }
    const proj = this.projectService.activeProject();
    if (!proj) return;
    const targetUser = this.authService.users().find(u => u.id === userId);
    if (!targetUser) return;

    const res = this.notifService.sendInvitation(
      proj.id,
      this.getProjectDisplayName(proj),
      targetUser.id,
      targetUser.username,
      targetUser.nombreCompleto,
      role
    );

    if (res.success) {
      this.notify(res.message);
      this.selectedUserToAdd.set('');
    } else {
      this.notify(res.message);
    }
  }

  aceptarInvitacion(invitationId: string) {
    const ok = this.notifService.acceptInvitation(invitationId);
    if (ok) {
      this.notify('✅ ¡Invitación aceptada! Ya eres colaborador del proyecto.');
    }
  }

  rechazarInvitacion(invitationId: string) {
    this.notifService.rejectInvitation(invitationId);
    this.notify('Invitación rechazada.');
  }

  cancelarInvitacion(invitationId: string) {
    this.notifService.cancelInvitation(invitationId);
    this.notify('Invitación cancelada.');
  }

  removerColaborador(userId: string) {
    const projId = this.projectService.activeProjectId();
    this.projectService.updateCollaboratorPermission(projId, userId, 'NONE');
    this.collabSocket.emitPermissionChange(userId, 'NONE');
    const user = this.authService.users().find(u => u.id === userId);
    this.notify(`Colaborador ${user?.nombreCompleto || ''} removido del proyecto.`);
  }

  toggleCollaboratorDownload(userId: string) {
    const projId = this.projectService.activeProjectId();
    const ok = this.projectService.toggleCollaboratorDownload(projId, userId);
    if (ok) {
      const allowed = this.canCollaboratorDownload(userId);
      this.notify(allowed 
        ? '✅ Descarga de backend ZIP habilitada para este colaborador.' 
        : '🔒 Descarga de backend revocada para este colaborador.');
    }
  }

  canCollaboratorDownload(userId: string): boolean {
    const proj = this.projectService.activeProject();
    if (!proj) return false;
    if (proj.ownerId === userId) return true;
    const c = proj.colaboradores.find(col => col.userId === userId);
    return !!(c && c.canDownloadBackend);
  }

  getOwnerName(ownerId: string): string {
    const u = this.authService.users().find(usr => usr.id === ownerId);
    return u ? u.nombreCompleto : 'Ingeniero Responsable';
  }

  getCollaboratorPermission(userId: string): ProjectPermission {
    const projId = this.projectService.activeProjectId();
    return this.projectService.getUserPermission(projId, userId);
  }

  cambiarProyecto(projectId: string) {
    this.abrirProyecto(projectId);
  }

  isElementLockedByOther(elementId: string): ElementLock | null {
    return this.collabSocket.isLockedByOther(elementId);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    const activeElement = document.activeElement;
    const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');

    // Atajos de Deshacer (Ctrl+Z) y Rehacer (Ctrl+Y / Ctrl+Shift+Z)
    if ((event.ctrlKey || event.metaKey) && !isInput) {
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          this.rehacer();
        } else {
          this.deshacer();
        }
        return;
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        this.rehacer();
        return;
      } else if (event.key.toLowerCase() === 'm') {
        // Atajo rápido: Ctrl+M para Activar / Desactivar el micrófono de Comandos de Voz UML
        event.preventDefault();
        this.voiceService.toggleListening();
        this.notify(this.voiceService.isListening() ? '🎙️ Micrófono UML Activo' : '🤫 Micrófono UML Silenciado');
        return;
      } else if (event.key.toLowerCase() === 'i') {
        // Atajo rápido: Ctrl+I para abrir el Generador de Diagramas por IA y Voz
        event.preventDefault();
        this.abrirModalPrompt();
        return;
      }
    }

    // Atajo alternativo Alt+V para abrir Generador IA / Voz
    if (event.altKey && event.key.toLowerCase() === 'v' && !isInput) {
      event.preventDefault();
      this.abrirModalPrompt();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (isInput) return;
      if (this.selectedClassId()) {
        this.eliminarClase(this.selectedClassId()!);
      } else if (this.selectedRelationId()) {
        this.eliminarRelacion(this.selectedRelationId()!);
      }
    }
  }

  // ========================================================
  // MODAL GENERADOR DE BACKEND SPRING BOOT + POSTGRESQL + POSTMAN
  // ========================================================
  showBackendModal = signal<boolean>(false);

  abrirModalBackend(): void {
    if (this.diagram().classes.length === 0) {
      this.notify('⚠️ Agrega o dibuja al menos 1 clase en el lienzo para generar el backend.');
    }
    if (!this.canDownloadCurrentProject()) {
      this.notify('🔒 Modo Consulta: Solo el Propietario del diagrama (o colaboradores autorizados) pueden descargar el código en ZIP.');
    }
    this.showBackendModal.set(true);
  }

  cerrarModalBackend(): void {
    this.showBackendModal.set(false);
  }

  // ========================================================
  // MODAL GENERADOR INTELIGENTE POR PROMPT Y VOZ (FASE 1)
  // ========================================================
  showPromptModal = signal<boolean>(false);

  abrirModalPrompt(): void {
    if (this.isReadOnly()) {
      this.notify('🔒 Modo Solo Lectura: Solo el Propietario o Editores pueden generar diagramas.');
      return;
    }
    this.showPromptModal.set(true);
  }

  cerrarModalPrompt(): void {
    this.showPromptModal.set(false);
  }

  aplicarDiagramaGenerado(event: { result: PromptGeneratedResult; replaceMode: boolean }): void {
    const { result, replaceMode } = event;
    if (!result || !result.classes || result.classes.length === 0) return;

    this.deseleccionarElemento();
    this.saveHistorySnapshot();

    if (replaceMode) {
      this.diagram.update(d => ({
        ...d,
        name: result.diagramName || d.name,
        description: result.description || d.description,
        classes: result.classes,
        relations: result.relations,
        updatedAt: new Date().toISOString()
      }));
      const projId = this.projectService.activeProjectId();
      if (projId && result.diagramName) {
        this.projectService.updateProjectName(projId, result.diagramName);
      }
    } else {
      let maxOffsetX = 0;
      this.diagram().classes.forEach(c => {
        if (c.position.x > maxOffsetX) maxOffsetX = c.position.x;
      });
      const shiftX = maxOffsetX > 0 ? maxOffsetX + 350 : 0;
      const shiftedClasses = result.classes.map(c => ({
        ...c,
        position: { x: c.position.x + shiftX, y: c.position.y }
      }));
      this.diagram.update(d => ({
        ...d,
        classes: [...d.classes, ...shiftedClasses],
        relations: [...d.relations, ...result.relations],
        updatedAt: new Date().toISOString()
      }));
    }

    this.saveCurrentProjectDiagram();
    this.collabSocket.emitDiagramChange(this.diagram(), `Generó ${result.classes.length} clases con IA/Voz (${result.diagramName})`);
    this.notify(`✨ ${result.summary}`);
    
    // Respuesta por voz 1 sola vez al aplicar el diagrama
    this.voiceService.speak(`Diagrama sintetizado con ${result.classes.length} clases.`);
    
    this.cerrarModalPrompt();
  }

  // ========================================================
  // MODAL DE AUDITORÍA Y NORMALIZACIÓN IA (1NF, 2NF, 3NF)
  // ========================================================
  abrirModalAuditoria(): void {
    if (this.diagram().classes.length === 0) {
      this.notify('⚠️ Agrega al menos 1 clase al lienzo para realizar la auditoría.');
      return;
    }
    this.showAuditModal.set(true);
  }

  cerrarModalAuditoria(): void {
    this.showAuditModal.set(false);
  }

  aplicarNormalizacion(updatedDiagram: UmlDiagram): void {
    if (!updatedDiagram) return;
    this.deseleccionarElemento();
    this.saveHistorySnapshot();

    this.diagram.set(updatedDiagram);
    this.saveCurrentProjectDiagram();
    this.collabSocket.emitDiagramChange(this.diagram(), 'Aplicó normalización de base de datos (1NF/2NF/3NF)');
    this.notify('✨ Diagrama normalizado y rediseñado exitosamente.');
  }
}

