import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  inject, signal, ViewEncapsulation, computed, OnInit, effect
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable, Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

// Services & Custom Imports
import { WorkflowDepartamentalService } from '../../api/api/workflowDepartamental.service';
import { SolicitudResponse } from '../../api/model/solicitudResponse';
import { AuthService, UserContext } from '../../auth/auth.service';
import { WorkflowSupportService, PresenciaUsuario } from '../../workflow/workflow-support.service';
import { BpmnExportService } from './bpmn-export.service';
import { WORKFLOW_BPMN_XML } from './bpmn-workspace.initial-xml';
import { DocumentoService, Documento, VersionDocumento } from '../../workflow/documento.service';
import { AdminDepartamentosService, Departamento } from '../../admin/admin-departamentos.service';
import { BPMN_DEFAULT_KPIS, BPMN_ESTADO_ELEMENT_MAP, BPMN_PRIORITY_WEIGHT } from './bpmn-workspace.constants';
import { BpmnSelectionInfo, CollaboratorCursor, DrillDownTab, EstadoWorkflow, FormFieldDefinition, KpiCard, NodeMetrics } from './bpmn-workspace.models';
import { BASE_PATH } from '../../api/variables';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AsistenteIAService } from '../../api/api/asistenteIA.service';
import { VoiceRecognitionService } from '../../shared/services/voice-recognition.service';

// Workspace Runtime Integration
import { WorkspaceMemory } from '../../runtime/workspace-memory.service';
import { DependencyResolver } from '../../runtime/dependency-resolver.service';
import { AttentionEngine } from '../../runtime/attention-engine.service';

@Component({
  selector: 'app-bpmn-workspace',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule, RouterLink, MatIconModule,
    FormsModule, ReactiveFormsModule
  ],
  templateUrl: './bpmn-workspace.component.html',
  styleUrl: './bpmn-workspace.component.css',
  providers: [VoiceRecognitionService]
})
export class BpmnWorkspaceComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('bpmnContainer', { static: true }) bpmnContainer!: ElementRef;

  // Services injection
  private readonly workflowApi = inject(WorkflowDepartamentalService);
  public readonly authService = inject(AuthService);
  private readonly supportService = inject(WorkflowSupportService);
  private readonly exportService = inject(BpmnExportService);
  private readonly docService = inject(DocumentoService);
  private readonly deptService = inject(AdminDepartamentosService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  public readonly basePath = inject(BASE_PATH);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly aiService = inject(AsistenteIAService);
  public readonly voiceService = inject(VoiceRecognitionService);

  voiceProcessingStatus = signal<string>('');

  constructor() {
    effect(() => {
      const text = this.voiceService.transcript();
      const isListening = this.voiceService.isListening();
      if (!isListening && text.trim().length > 0) {
        const query = text.trim();
        this.voiceService.clear();
        this.procesarComandosVoz(query);
      }
    }, { allowSignalWrites: true });
  }

  // Runtime Injections
  public readonly memory = inject(WorkspaceMemory);
  public readonly dependencyResolver = inject(DependencyResolver);
  public readonly attentionEngine = inject(AttentionEngine);

  // Modeler state
  private modeler: any = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private sseSubscription: Subscription | null = null;
  private sseCloseFn: (() => void) | null = null;

  // Real-time collaboration cursors
  collaborators = signal<Record<string, CollaboratorCursor>>({});
  collaboratorsList = computed(() => Object.values(this.collaborators()));
  private isImporting = false;
  private lastMouseBroadcast = 0;
  private currentUsername = '';
  private purgeTimer: any;

  // BPMN highlights & details
  private readonly markerClass = 'workflow-highlighted-node';
  private readonly estadoElementoMap = BPMN_ESTADO_ELEMENT_MAP;
  private readonly prioridadPeso = BPMN_PRIORITY_WEIGHT;

  // UI General States
  loading = signal(false);
  saving = signal(false);
  hasUnsavedChanges = signal(false);
  errorMessage = signal('');
  lastSyncLabel = signal('');
  saveMessage = signal('');
  saveComment = signal('');
  exportMenuOpen = signal(false);

  sseConnected = signal(false);
  diagramVersion = signal(0);
  lastEditor = signal('');
  canvasMinimized = signal(false);
  mobileMenuOpen = signal(false);

  // active workflow tickets
  allTickets = signal<SolicitudResponse[]>([]);
  kpis = signal<KpiCard[]>(BPMN_DEFAULT_KPIS.map((item) => ({ ...item })));

  // Right sidebar tab selection: 0 = Departamentos, 1 = Documentos
  activeTab = signal<number>(0);

  // Departamentos Tab State
  departamentos = signal<Departamento[]>([]);
  loadingDepts = signal(false);
  creatingDept = signal(false);
  newDeptNombre = signal('');
  newDeptDesc = signal('');
  deptSearchQuery = signal('');
  
  filteredDepartamentos = computed(() => {
    const query = this.deptSearchQuery().toLowerCase().trim();
    if (!query) return this.departamentos();
    return this.departamentos().filter(d => 
      d.nombre.toLowerCase().includes(query) || 
      d.descripcion?.toLowerCase().includes(query)
    );
  });

  expandedDeptId = signal<string | null>(null);
  expandedDeptsSolicitudes = signal<Record<string, boolean>>({});

  toggleDeptExpand(deptName: string) {
    this.expandedDeptId.update(current => current === deptName ? null : deptName);
  }

  toggleDeptSolicitudesExpand(deptName: string) {
    this.expandedDeptsSolicitudes.update(prev => ({
      ...prev,
      [deptName]: !prev[deptName]
    }));
  }

  /** Navigate to crear-solicitud page, pre-selecting the department */
  navigateToCrear(departamento?: string) {
    this.router.navigate(['/crear'], departamento ? { queryParams: { depto: departamento } } : {});
  }

  /** Navigate to solicitud detail page */
  navigateToDetalle(solicitudId: string) {
    this.router.navigate(['/detalle', solicitudId]);
  }

  // Documentos Tab State
  documentos = signal<Documento[]>([]);
  loadingDocs = signal(false);
  selectedDoc = signal<Documento | null>(null);
  filterQuery = signal('');

  filteredDocumentos = computed(() => {
    const query = this.filterQuery().toLowerCase().trim();
    const user = this.authService.currentUser();
    let list = this.documentos();

    if (!user) return [];

    if (user.rol === 'SOLICITANTE') {
      const misSolicitudesIds = this.allTickets()
        .filter(t => t.usuarioCreador === user.username)
        .map(t => t.id)
        .filter(Boolean) as string[];

      list = list.filter(d => 
        d.creadoPor === user.username || 
        misSolicitudesIds.includes(d.solicitudId)
      );
    }

    if (query) {
      return list.filter(d => 
        d.nombre.toLowerCase().includes(query) || 
        d.descripcion?.toLowerCase().includes(query) ||
        d.creadoPor.toLowerCase().includes(query)
      );
    }
    return list;
  });

  // Modals signals
  showModalCrearDoc = signal(false);
  tipoCreacion = signal<'FILE' | 'COLLABORATIVE'>('FILE');
  submittingDoc = signal(false);
  selectedFile: File | null = null;

  showModalNuevoProceso = signal(false);
  submittingNuevoProceso = signal(false);

  docForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: ['', [Validators.maxLength(250)]],
    contenidoInicial: ['']
  });

  nuevoProcesoForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    key: ['', [Validators.required, Validators.pattern(/^[a-z0-9\-]+$/)]],
    description: ['', [Validators.maxLength(250)]]
  });

  // Selected BPMN canvas element info
  selectedElement = signal<BpmnSelectionInfo | null>(null);
  formFields = signal<FormFieldDefinition[]>([]);

  selectedElementCount = computed<number | null>(() => {
    const estado = this.selectedElement()?.estado;
    if (!estado) return null;
    const kpi = this.kpis().find((item) => item.estado === estado);
    return kpi?.count ?? 0;
  });

  // Documents mapped to the currently selected node
  selectedElementDocs = signal<Documento[]>([]);
  loadingElementDocs = signal<boolean>(false);

  // ─── Drill-Down Operational Panel ──────────────────────────────────
  drillDownOpen = signal(false);
  drillDownTab = signal<DrillDownTab>('solicitudes');
  nodeMetricsMap = signal<Record<string, NodeMetrics>>({});

  drillDownTickets = computed(() => {
    const el = this.selectedElement();
    if (!el) return [];
    
    const activeKey = this.selectedWorkflowKey();

    // 1. Direct BPMN process tracking match (Highest precedence)
    const trackedTickets = this.allTickets().filter((t: any) => 
      t.workflowDefinitionId === activeKey && 
      t.tareaActualId === el.id
    );
    if (trackedTickets.length > 0) {
      return trackedTickets;
    }
    
    // 2. Try matching via the map first (Activity_Pendiente -> PENDIENTE)
    const estado = this.getEstadoFromElementId(el.id);
    if (estado) {
      return this.allTickets().filter(t => t.estado === estado);
    }
    
    // 3. Try matching via the name (e.g. #WF-2026-467: Title)
    if (el.name) {
      const match = el.name.match(/#(WF-[0-9a-zA-Z-]+)/i);
      if (match && match[1]) {
        const code = match[1].toUpperCase();
        const found = this.allTickets().find(t => t.codigoSeguimiento?.toUpperCase() === code);
        return found ? [found] : [];
      }
    }
    
    // 4. Match via wf:solicitudes attribute of the selected element
    if (this.modeler) {
      try {
        const elementRegistry = this.modeler.get('elementRegistry');
        const shape = elementRegistry.get(el.id);
        const linkedIdsStr = this.getWfAttr(shape?.businessObject, 'solicitudes') || '';
        if (linkedIdsStr) {
          const linkedIds = linkedIdsStr.split(',').map((id: string) => id.trim().toUpperCase());
          return this.allTickets().filter(t => 
            linkedIds.includes(t.id?.toUpperCase() || '') || 
            linkedIds.includes(t.codigoSeguimiento?.toUpperCase() || '')
          );
        }
      } catch (err) {
        console.warn('Error reading wf:solicitudes attribute', err);
      }
    }

    // 5. If it's a Lane or Participant (swimlane/pool), match all tickets belonging to this department
    if (el.type === 'bpmn:Lane' || el.type === 'bpmn:Participant') {
      let deptName = '';
      if (this.modeler) {
        try {
          const elementRegistry = this.modeler.get('elementRegistry');
          const shape = elementRegistry.get(el.id);
          deptName = this.getWfAttr(shape?.businessObject, 'departamento') || '';
        } catch {}
      }
      if (!deptName && el.name) {
        deptName = el.name;
      }
      if (deptName) {
        return this.allTickets().filter(t => 
          t.departamentoActual?.toLowerCase() === deptName.toLowerCase()
        );
      }
    }
    
    return [];
  });

  assignedTicketsSet = computed(() => {
    this.selectedElement();
    this.hasUnsavedChanges();
    return new Set(this.obtenerTicketsAsignadosEnDiagrama());
  });

  isTicketAssigned(ticketCodeOrId: string): boolean {
    const code = ticketCodeOrId?.toUpperCase();
    return this.assignedTicketsSet().has(code);
  }

  obtenerTicketsAsignadosEnDiagrama(): string[] {
    if (!this.modeler) return [];
    const assigned: string[] = [];
    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const elements = elementRegistry.getAll();
      elements.forEach((e: any) => {
        if ((e.type === 'bpmn:UserTask' || e.type === 'bpmn:Task') && e.businessObject) {
          const linkedStr = this.getWfAttr(e.businessObject, 'solicitudes') || '';
          if (linkedStr) {
            linkedStr.split(',').forEach((val: string) => {
              const cleaned = val.trim().toUpperCase();
              if (cleaned) assigned.push(cleaned);
            });
          }
          const name = e.businessObject.name || '';
          const match = name.match(/#(WF-[0-9a-zA-Z-]+)/i);
          if (match && match[1]) {
            assigned.push(match[1].toUpperCase());
          }
        }
      });
    } catch (err) {
      console.warn('Error scanning assigned tickets in diagram', err);
    }
    return assigned;
  }

  obtenerDepartamentoDeElementoSeleccionado(): string | null {
    const el = this.selectedElement();
    if (!el || !this.modeler) return null;
    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const shape = elementRegistry.get(el.id);
      return this.getWfAttr(shape?.businessObject, 'departamento');
    } catch {
      return null;
    }
  }

  obtenerDepartamentoDeElemento(elementId: string): string | null {
    if (!this.modeler || !elementId) return null;
    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const shape = elementRegistry.get(elementId);
      return this.getWfAttr(shape?.businessObject, 'departamento');
    } catch {
      return null;
    }
  }

  obtenerSolicitudesSinAsignarDeDepto(): SolicitudResponse[] {
    const el = this.selectedElement();
    if (!el || !this.modeler) return [];

    let deptoNombre = this.obtenerDepartamentoDeElemento(el.id);
    
    // Fallback: Si el nodo no tiene departamento, usar el del usuario actual (si es Revisor)
    if (!deptoNombre) {
      const user = this.authService.currentUser();
      if (user?.rol === 'REVISOR') {
        deptoNombre = user.departamento;
      }
    }

    if (!deptoNombre) return [];

    const assignedCodesAndIds = this.obtenerTicketsAsignadosEnDiagrama();

    return this.allTickets().filter((t: SolicitudResponse) => 
      t.departamentoActual?.toLowerCase() === deptoNombre?.toLowerCase() && 
      !assignedCodesAndIds.includes(t.codigoSeguimiento?.toUpperCase() || '') &&
      !assignedCodesAndIds.includes(t.id?.toUpperCase() || '')
    );
  }

  asignarTicketATarea(ticketIdOrCode: string) {
    const el = this.selectedElement();
    if (!el || !this.modeler) return;
    
    this.updateLocalDiagramAssignment(ticketIdOrCode, el);
    // Mark changes to enable the Save button
    this.hasUnsavedChanges.set(true);
  }

  private updateLocalDiagramAssignment(ticketIdOrCode: string, el: any) {
    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const modeling = this.modeler.get('modeling');
      const shape = elementRegistry.get(el.id);
      if (!shape || !shape.businessObject) return;
      
      this.ensureAttrsExist(shape.businessObject);
      
      // 1. Quitar de cualquier otro nodo (mantener 1 a 1)
      const elements = elementRegistry.getAll();
      elements.forEach((e: any) => {
        if (e.id !== el.id && (e.type === 'bpmn:UserTask' || e.type === 'bpmn:Task') && e.businessObject) {
          const linkedStr = this.getWfAttr(e.businessObject, 'solicitudes') || '';
          if (linkedStr) {
            const list = linkedStr.split(',').map((s: string) => s.trim().toUpperCase());
            const filtered = list.filter((s: string) => s !== ticketIdOrCode.toUpperCase());
            this.setWfAttr(e, 'solicitudes', filtered.join(','));
          }
        }
      });
      
      // 2. Añadir al nodo seleccionado
      const currentLinked = this.getWfAttr(shape.businessObject, 'solicitudes') || '';
      const list = currentLinked ? currentLinked.split(',').map((s: string) => s.trim().toUpperCase()) : [];
      if (!list.includes(ticketIdOrCode.toUpperCase())) {
        list.push(ticketIdOrCode.toUpperCase());
        this.setWfAttr(shape, 'solicitudes', list.join(','));
      }
      
      this.selectedElement.set({ ...el });
    } catch (err) {
      console.error('Error in local ticket assignment:', err);
    }
  }

  desasignarTicketDeTarea(ticketIdOrCode: string) {
    const el = this.selectedElement();
    if (!el || !this.modeler) return;
    
    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const modeling = this.modeler.get('modeling');
      const shape = elementRegistry.get(el.id);
      if (!shape || !shape.businessObject) return;
      
      const currentLinked = this.getWfAttr(shape.businessObject, 'solicitudes') || '';
      if (currentLinked) {
        const list = currentLinked.split(',').map((s: string) => s.trim().toUpperCase());
        const filtered = list.filter((s: string) => s !== ticketIdOrCode.toUpperCase());
        
        this.setWfAttr(shape, 'solicitudes', filtered.join(','));
        this.selectedElement.set({ ...el });
      }
    } catch (err) {
      console.error('Error desassigning ticket', err);
    }
  }

  drillDownMetrics = computed<NodeMetrics>(() => {
    const tickets = this.drillDownTickets();
    return this.computeMetricsForTickets(tickets);
  });

  drillDownUsers = computed(() => {
    const tickets = this.drillDownTickets();
    const userMap = new Map<string, { count: number; urgentes: number }>();
    for (const t of tickets) {
      const u = t.usuarioAsignado || 'Sin asignar';
      const prev = userMap.get(u) || { count: 0, urgentes: 0 };
      prev.count++;
      if (t.prioridad === 'URGENTE' || t.prioridad === 'ALTA') prev.urgentes++;
      userMap.set(u, prev);
    }
    return Array.from(userMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  });

  getEstadoFromElementId(elementId: string): string | null {
    const entries = Object.entries(this.estadoElementoMap);
    for (const [estado, elId] of entries) {
      if (elId === elementId) return estado;
    }
    return null;
  }

  private computeMetricsForTickets(tickets: SolicitudResponse[]): NodeMetrics {
    const now = Date.now();
    const total = tickets.length;
    let slaCritico = 0;
    let slaPorVencer = 0;
    let urgentes = 0;
    let sumaMinutos = 0;

    for (const t of tickets) {
      if (t.estadoSla === 'VENCIDO' || (t.minutosRestantesSla != null && t.minutosRestantesSla < 0)) slaCritico++;
      if (t.estadoSla === 'POR_VENCER') slaPorVencer++;
      if (t.prioridad === 'URGENTE' || t.prioridad === 'ALTA') urgentes++;
      if (t.fechaCreacion) {
        sumaMinutos += (now - new Date(t.fechaCreacion).getTime()) / 60000;
      }
    }

    const promedioMinutos = total > 0 ? Math.round(sumaMinutos / total) : 0;
    return { total, slaCritico, slaPorVencer, urgentes, promedioMinutos, promedioLabel: this.formatMinutes(promedioMinutos) };
  }

  private formatMinutes(mins: number): string {
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.round(mins / 60)}h`;
    return `${Math.round(mins / 1440)}d`;
  }

  openDrillDown() {
    this.drillDownOpen.set(true);
    this.drillDownTab.set('solicitudes');
  }

  closeDrillDown() {
    this.drillDownOpen.set(false);
  }

  countByPriority(prioridad: string): number {
    return this.drillDownTickets().filter(t => t.prioridad === prioridad).length;
  }

  // Workflow Definitions Catalog & Autosave
  definitions = signal<any[]>([]);
  selectedWorkflowKey = signal<string>('procurement-workflow');
  activeWorkflow = computed(() => {
    const key = this.selectedWorkflowKey();
    return this.definitions().find(d => d.key === key) || { name: 'Procurement Workflow', key: 'procurement-workflow', version: 1 };
  });
  autosaveEnabled = signal<boolean>(true);
  departamentoAislado = signal<string | null>(null);
  private autosaveDebounce: any = null;

  // Built-in focused view overlay states
  editorActivo = signal(false);
  visorActivo = signal(false);
  modalSnapshot = signal(false);
  mostrarGuiaNegocio = signal(false);
  contenidoEditor = '';
  comentarioSnapshot = '';

  // Local storage mapping for node-document linkages
  // Format: { [elementId]: 'doc1,doc2' }
  private elementDocumentLinkages: Record<string, string> = {};

  ngOnInit() {
    this.cargarDepartamentos();
    this.cargarDocumentos();
    this.currentUsername = this.authService.currentUser()?.username || 'Usuario';
  }

  async ngAfterViewInit() {
    try {
      const [{ default: BpmnModeler }, { default: BpmnColorPickerModule }] = await Promise.all([
        import('bpmn-js/lib/Modeler'),
        import('bpmn-js-color-picker')
      ]);

      // ─── Moddle Extension: Registrar Namespace 'wf' para persistencia correcta ───
      const workflowModdle = {
        name: 'workflow',
        uri: 'http://workflow.com/schema',
        prefix: 'wf',
        xml: { tagAlias: 'lowerCase' },
        types: [
          {
            name: 'WorkflowElement',
            extends: ['bpmn:Task', 'bpmn:UserTask', 'bpmn:ManualTask', 'bpmn:ServiceTask'],
            properties: [
              { name: 'form', isAttr: true, type: 'String' },
              { name: 'solicitudes', isAttr: true, type: 'String' },
              { name: 'departamento', isAttr: true, type: 'String' },
              { name: 'documentos', isAttr: true, type: 'String' }
            ]
          }
        ]
      };

      this.modeler = new BpmnModeler({
        container: this.bpmnContainer.nativeElement,
        additionalModules: [
          BpmnColorPickerModule
        ],
        moddleExtensions: {
          wf: workflowModdle
        },
        bpmnRenderer: {
          defaultFillColor: '#f8fafc',
          defaultStrokeColor: 'var(--theme-slate-500)'
        }
      });

      const isAdminOrRevisor = this.authService.currentUser()?.rol === 'ADMINISTRADOR' || this.authService.currentUser()?.rol === 'REVISOR';

      this.modeler.get('eventBus').on('commandStack.changed', async () => {
        if (this.isImporting || !isAdminOrRevisor) return;
        this.hasUnsavedChanges.set(true);
        this.onDiagramChanged();
        try {
          const { xml } = await this.modeler.saveXML({ format: true });
          this.supportService.emitirEventoColaborativo('XML_UPDATE', { xml, username: this.currentUsername }).subscribe({error: () => {}});
        } catch {}
      });

      // Dragging movements broadcast
      this.modeler.get('eventBus').on('shape.move.move', (event: any) => {
        if (!this.sseConnected() || !isAdminOrRevisor) return;
        const shapeId = event.shape.id;
        const x = event.shape.x;
        const y = event.shape.y;
        
        this.supportService.emitirEventoColaborativo('SHAPE_MOVE', {
          shapeId, x, y, username: this.currentUsername
        }).subscribe({error: () => {}});
      });

      // Canvas Element selection change
      this.modeler.get('eventBus').on('selection.changed', (event: any) => {
        const selected = event?.newSelection?.[0];
        if (!selected) {
          this.selectedElement.set(null);
          this.selectedElementDocs.set([]);
          return;
        }

        const businessObject = selected.businessObject;
        const id = businessObject?.id || selected.id || 'sin-id';
        const name = businessObject?.name || selected.id || 'Elemento';
        const type = businessObject?.$type || selected.type || 'BPMN Element';

        // Filtrar para que SOLO se traten como seleccionados los nodos de tipo Tarea (UserTask, ServiceTask, etc.)
        const isTask = type.toLowerCase().includes('task');
        if (!isTask) {
          this.selectedElement.set(null);
          this.selectedElementDocs.set([]);
          return;
        }

        this.selectedElement.set({
          id,
          name,
          type,
          estado: this.obtenerEstadoDesdeElemento(id)
        });

        this.cargarDocumentosDeEtapa(id);

        // Auto-expand and focus the corresponding department card in the sidebar
        const assignedDepto = this.getWfAttr(businessObject, 'departamento');
        if (assignedDepto) {
          this.expandedDeptId.set(assignedDepto);
        }
      });

      await this.cargarDiagramaDesdeBackend();
      this.zoomFit();

      this.loadLiveData();
      this.iniciarSSE();
      this.refreshTimer = setInterval(() => this.loadLiveData(true), 30000);

      this.purgeTimer = setInterval(() => {
        const now = Date.now();
        this.collaborators.update(prev => {
           let changed = false;
           const next = { ...prev };
           for (const key of Object.keys(next)) {
             if (now - next[key].lastSeen > 4000) { delete next[key]; changed = true; }
           }
           return changed ? next : prev;
         });
      }, 2000);
    } catch (err) {
      console.error('Error loading BPMN Modeler', err);
      this.errorMessage.set('No fue posible inicializar el diagrama BPMN.');
    }
  }

  ngOnDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    this.sseSubscription?.unsubscribe();
    this.sseCloseFn?.();
    this.modeler?.destroy();
  }

  // ─── Document Linkage helpers ──────────────────────────────────────
  getLinkedDocIds(elementId: string): string[] {
    if (!this.modeler) return [];
    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const el = elementRegistry.get(elementId);
      const docs = this.getWfAttr(el?.businessObject, 'documentos');
      if (docs) {
        return docs.split(',').filter((x: string) => x.trim().length > 0);
      }
    } catch {}
    
    const local = this.elementDocumentLinkages[elementId];
    return local ? local.split(',').filter(x => x.trim().length > 0) : [];
  }

  vincularDocumento(docId: string, tipoVinculo: 'TAREA' | 'SOLICITUD', solicitudId?: string) {
    const el = this.selectedElement();
    if (!el || !el.id || !this.modeler) return;

    const targetSolicitudId = tipoVinculo === 'SOLICITUD' ? solicitudId : undefined;
    const targetTareaId = tipoVinculo === 'TAREA' ? el.id : undefined;

    this.docService.asociarASolicitud(docId, targetSolicitudId, targetTareaId).subscribe({
      next: (docActualizado) => {
        if (tipoVinculo === 'TAREA') {
          try {
            const elementRegistry = this.modeler.get('elementRegistry');
            const modeling = this.modeler.get('modeling');
            const shape = elementRegistry.get(el.id);

            if (shape && shape.businessObject) {
              const currentIds = this.getLinkedDocIds(el.id);
              if (!currentIds.includes(docId)) {
                currentIds.push(docId);
                this.setWfAttr(shape, 'documentos', currentIds.join(','));
                this.elementDocumentLinkages[el.id] = currentIds.join(',');

                // Force template reactive recalculation
                this.selectedElement.set({ ...el });
              }
            }
          } catch (e) {
            console.error('Error updating BPMN XML for linked doc', e);
          }
        }
        
        this.cargarDocumentosDeEtapa(el.id);
        this.cargarDocumentos();
        this.guardarDiagrama('Documento "' + docActualizado.nombre + '" vinculado.');
      },
      error: (err) => {
        alert('Error al vincular el documento: ' + this.extraerMensajeError(err));
      }
    });
  }

  desvincularDocumento(docId: string) {
    const el = this.selectedElement();
    if (!el || !el.id || !this.modeler) return;

    // Desasociar en el backend poniéndole un id de etapa genérico
    this.docService.asociarASolicitud(docId, 'bpmn-central').subscribe({
      next: () => {
        try {
          const elementRegistry = this.modeler.get('elementRegistry');
          const modeling = this.modeler.get('modeling');
          const shape = elementRegistry.get(el.id);

          if (shape && shape.businessObject) {
            const currentIds = this.getLinkedDocIds(el.id);
            const filtered = currentIds.filter(id => id !== docId);

            if (filtered.length > 0) {
              this.setWfAttr(shape, 'documentos', filtered.join(','));
              this.elementDocumentLinkages[el.id] = filtered.join(',');
            } else {
              this.setWfAttr(shape, 'documentos', null);
              delete this.elementDocumentLinkages[el.id];
            }

            this.selectedElement.set({ ...el });
          }
        } catch (e) {
          console.error('Error updating BPMN XML for unlinked doc', e);
        }
        this.cargarDocumentosDeEtapa(el.id);
        this.cargarDocumentos();
        this.guardarDiagrama('Documento desvinculado de la tarea.');
      },
      error: (err) => {
        alert('Error al desvincular el documento: ' + this.extraerMensajeError(err));
      }
    });
  }

  // ─── Persistence ───────────────────────────────────────────────────

  private async cargarDiagramaDesdeBackend() {
    try {
      this.listarDefiniciones();

      const def = await new Promise<any>((resolve, reject) => {
        this.supportService.obtenerWorkflowDefinition(this.selectedWorkflowKey()).subscribe({
          next: (d: any) => resolve(d),
          error: (e: any) => reject(e)
        });
      });

      if (def && def.xml) {
        await this.modeler.importXML(def.xml);
        this.diagramVersion.set(def.version || 1);
        this.lastEditor.set(def.editadoPor || '');
      } else {
        await this.modeler.importXML(WORKFLOW_BPMN_XML);
      }
      this.colorearNodos();
      this.parseAllXMLAttrs();
    } catch {
      await this.modeler.importXML(WORKFLOW_BPMN_XML);
      this.colorearNodos();
    }
  }

  // Parse all custom wf:documentos attributes in the diagram
  private parseAllXMLAttrs() {
    if (!this.modeler) return;
    try {
      const registry = this.modeler.get('elementRegistry');
      const elements = registry.getAll();
      for (const el of elements) {
        const docLinks = this.getWfAttr(el.businessObject, 'documentos');
        if (docLinks) {
          this.elementDocumentLinkages[el.id] = docLinks;
        }
      }
    } catch {}
  }

  async guardarDiagrama(customComment?: string) {
    if (!this.modeler || this.saving()) return;

    this.saving.set(true);
    this.saveMessage.set('');

    try {
      const { xml } = await this.modeler.saveXML({ format: true });
      const comentario = customComment || this.saveComment().trim() || 'Guardado desde Diseñador BPMN';
      const myUser = this.authService.currentUser()?.username || 'Usuario';
      const myDept = this.authService.currentUser()?.departamento || '';

      const defPayload = {
        key: this.selectedWorkflowKey(),
        name: this.definitions().find(d => d.key === this.selectedWorkflowKey())?.name || 'Proceso BPMN',
        description: this.definitions().find(d => d.key === this.selectedWorkflowKey())?.description || '',
        xml: xml,
        comentario: comentario
      };

      this.supportService.guardarWorkflowDefinition(defPayload, myUser, myDept).subscribe({
        next: (saved: any) => {
          // Después de guardar el XML, sincronizar las asignaciones de tickets al backend
          this.syncTicketAssignmentsToBackend();

          this.saving.set(false);
          this.hasUnsavedChanges.set(false);
          this.diagramVersion.set(saved.version);
          this.lastEditor.set(saved.editadoPor);
          this.saveMessage.set('Sincronizado v' + saved.version);
          this.saveComment.set('');
          setTimeout(() => this.saveMessage.set(''), 4000);
          this.listarDefiniciones(); // refresh list
        },
        error: (err: any) => {
          this.saving.set(false);
          this.saveMessage.set('Error al guardar: ' + this.extraerMensajeError(err));
        }
      });
    } catch (e) {
      this.saving.set(false);
      this.saveMessage.set('Error al exportar XML');
    }
  }

  private syncTicketAssignmentsToBackend() {
    if (!this.modeler) return;
    const flowKey = this.selectedWorkflowKey();
    if (!flowKey) return;

    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const allElements = elementRegistry.getAll();
      
      allElements.forEach((el: any) => {
        if ((el.type === 'bpmn:UserTask' || el.type === 'bpmn:Task') && el.businessObject) {
          const linkedStr = this.getWfAttr(el.businessObject, 'solicitudes') || '';
          const ticketCodes = linkedStr ? linkedStr.split(',').map((s: string) => s.trim().toUpperCase()) : [];
          
          ticketCodes.forEach((code: string) => {
            if (!code) return;
            const ticket = this.allTickets().find(t => t.codigoSeguimiento?.toUpperCase() === code);
            if (ticket && ticket.id) {
              // Si el ticket no tiene flow o tarea vinculada correctamente, sincronizar
              if (ticket.workflowDefinitionId !== flowKey || ticket.tareaActualId !== el.id) {
                this.supportService.cambiarTareaBpm(ticket.id, flowKey, el.id, el.businessObject.name || el.id).subscribe();
              }
            }
          });
        }
      });
    } catch (e) {
      console.warn('Error syncing ticket assignments', e);
    }
  }

  // ─── SSE Real-Time Collaboration ────────────────────────────────────

  private iniciarSSE() {
    try {
      const { events$, close } = this.supportService.suscribirEventosBpmn();
      this.sseCloseFn = close;

      this.sseSubscription = events$.subscribe({
        next: (event) => {
          if (event.type === 'CONNECTED') {
            this.sseConnected.set(true);
            if (event.data?.version) {
              this.diagramVersion.set(event.data.version);
            }
          }

          if (event.type === 'DIAGRAM_UPDATED') {
            const editor = event.data?.editadoPor || 'desconocido';

            this.diagramVersion.set(event.data?.version || 0);
            this.lastEditor.set(editor);

            if (editor !== this.currentUsername) {
              this.saveMessage.set(editor.toUpperCase() + ' actualizó el lienzo — recargando...');
              this.recargarDiagramaDesdeBackend();
            }
          }

          if (event.type === 'COLABORACION') {
            const data = event.data?.evento;
            const evtUser = event.data?.usuario;
            if (evtUser === this.currentUsername) return;

            if (data?.tipo === 'CURSOR') {
              const p = data.payload;
              this.collaborators.update(prev => ({
                ...prev,
                [evtUser]: { username: evtUser, x: p.x, y: p.y, name: p.nombreCompleto, rol: p.rol, depto: p.depto, lastSeen: Date.now() }
              }));
            }

            if (data?.tipo === 'XML_UPDATE') {
              const p = data.payload;
              if (p.xml && this.modeler) {
                this.isImporting = true;
                const canvas = this.modeler.get('canvas');
                const viewbox = canvas.viewbox();

                this.modeler.importXML(p.xml).then(() => {
                  canvas.viewbox(viewbox);
                  this.isImporting = false;
                  this.colorearNodos();
                  this.parseAllXMLAttrs();
                  
                  const conteo = this.conteoPorEstado(this.allTickets());
                  this.updateOverlays(conteo);
                }).catch(() => { this.isImporting = false; });
              }
            }

            if (data?.tipo === 'SHAPE_MOVE') {
              const p = data.payload;
              if (this.modeler) {
                try {
                  const elementRegistry = this.modeler.get('elementRegistry');
                  const modeling = this.modeler.get('modeling');
                  const shape = elementRegistry.get(p.shapeId);
                  
                  if (shape && p.x !== undefined && p.y !== undefined) {
                     const deltaX = p.x - shape.x;
                     const deltaY = p.y - shape.y;
                     this.isImporting = true;
                     modeling.moveElements([shape], { x: deltaX, y: deltaY });
                     this.isImporting = false;
                  }
                } catch {}
              }
            }
          }
        },
        error: () => {
          this.sseConnected.set(false);
          setTimeout(() => this.iniciarSSE(), 10000);
        }
      });
    } catch {
      this.sseConnected.set(false);
    }
  }

  private async recargarDiagramaDesdeBackend() {
    try {
      const diagrama = await new Promise<any>((resolve, reject) => {
        this.supportService.cargarDiagramaBpmn().subscribe({
          next: (d) => resolve(d),
          error: (e) => reject(e)
        });
      });

      if (diagrama?.xml && this.modeler) {
        await this.modeler.importXML(diagrama.xml);
        this.zoomFit();
        this.diagramVersion.set(diagrama.version || 0);
        this.lastEditor.set(diagrama.editadoPor || '');
        this.colorearNodos();
        this.parseAllXMLAttrs();
        setTimeout(() => this.saveMessage.set(''), 3000);

        const conteo = this.conteoPorEstado(this.allTickets());
        this.updateOverlays(conteo);
      }
    } catch (e) {
      console.error('[BPMN] Error al recargar diagrama', e);
    }
  }

  onMouseMove(e: MouseEvent) {
    if (!this.sseConnected()) return;
    const now = Date.now();
    if (now - this.lastMouseBroadcast > 100) {
      this.lastMouseBroadcast = now;
      const user = this.authService.currentUser();
      if (!user) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.supportService.emitirEventoColaborativo('CURSOR', {
        x, y,
        nombreCompleto: user.nombreCompleto || user.username,
        rol: user.rol,
        depto: user.departamento || 'Sin Depto'
      }).subscribe({ error: () => {} });
    }
  }

  // ─── Data Loading ───────────────────────────────────────────────────

  loadLiveData(fromAutoRefresh = false) {
    const user = this.authService.currentUser();
    if (!user) return;

    const request$ = user.rol === 'SOLICITANTE'
      ? this.workflowApi.listarPorUsuario(user.username)
      : this.workflowApi.listarTodas();

    request$.subscribe({
      next: (res) => {
        const tickets = res.datos ?? [];
        const conteo = this.conteoPorEstado(tickets);
        this.allTickets.set(tickets);
        this.updateKpis(conteo);
        this.updateOverlays(conteo);
        this.lastSyncLabel.set(this.formatearHora(new Date()));
      },
      error: (err) => {
        console.warn('Error loading workflow tickets:', err);
      }
    });
  }

  private conteoPorEstado(tickets: SolicitudResponse[]): Record<EstadoWorkflow, number> {
    const conteo: Record<EstadoWorkflow, number> = {
      PENDIENTE: 0, EN_REVISION: 0, APROBADO: 0, RECHAZADO: 0, BLOQUEADO: 0, SLA_CRITICO: 0
    };
    for (const ticket of tickets) {
      const estado = ticket.estado as EstadoWorkflow | undefined;
      if (estado && estado in conteo) conteo[estado] += 1;
    }
    return conteo;
  }

  private updateKpis(conteo: Record<EstadoWorkflow, number>) {
    this.kpis.update(current => current.map(k => ({ ...k, count: conteo[k.estado] })));
  }

  private updateOverlays(conteo: Record<EstadoWorkflow, number>) {
    if (!this.modeler) return;
    try {
      const overlays = this.modeler.get('overlays');
      const registry = this.modeler.get('elementRegistry');
      overlays.clear();

      const allTickets = this.allTickets();
      const metricsMap: Record<string, NodeMetrics> = {};

      // 1. Procesar Estados Maestros (los del mapa estático)
      const estados = Object.keys(this.estadoElementoMap) as EstadoWorkflow[];
      for (const estado of estados) {
        const elementId = this.estadoElementoMap[estado];
        if (!elementId) continue;
        const exists = registry.get(elementId);
        if (!exists) continue;

        const ticketsEnEtapa = allTickets.filter(t => t.estado === estado);
        const metrics = this.computeMetricsForTickets(ticketsEnEtapa);
        metricsMap[elementId] = metrics;
        this.addOverlayToElement(elementId, metrics, estado.toLowerCase().replace('_', '-'));
      }

      // 2. Procesar TODAS las demás tareas del diagrama (Vinculaciones manuales)
      const allElements = registry.getAll();
      allElements.forEach((el: any) => {
        if ((el.type === 'bpmn:UserTask' || el.type === 'bpmn:Task') && el.businessObject) {
          // Si ya lo procesamos arriba como estado maestro, saltar
          if (Object.values(this.estadoElementoMap).includes(el.id)) return;

          // Obtener tickets vinculados a este nodo específico
          const linkedStr = this.getWfAttr(el.businessObject, 'solicitudes') || '';
          const linkedCodes = linkedStr ? linkedStr.split(',').map((s: string) => s.trim().toUpperCase()) : [];
          
          // También buscar por nombre #WF-XXXX
          const nameMatch = (el.businessObject.name || '').match(/#(WF-[0-9a-zA-Z-]+)/i);
          if (nameMatch && nameMatch[1]) linkedCodes.push(nameMatch[1].toUpperCase());

          if (linkedCodes.length > 0) {
            const ticketsEnNodo = allTickets.filter(t => 
              linkedCodes.includes(t.codigoSeguimiento?.toUpperCase() || '') ||
              linkedCodes.includes(t.id?.toUpperCase() || '')
            );

            if (ticketsEnNodo.length > 0) {
              const metrics = this.computeMetricsForTickets(ticketsEnNodo);
              metricsMap[el.id] = metrics;
              this.addOverlayToElement(el.id, metrics, 'custom-task');
            }
          }
        }
      });

      this.nodeMetricsMap.set(metricsMap);
    } catch (err) {
      console.warn('[BPMN Overlays] Error updating overlays:', err);
    }
  }

  private addOverlayToElement(elementId: string, metrics: NodeMetrics, themeClass: string) {
    if (!this.modeler) return;
    const overlays = this.modeler.get('overlays');
    const hasTraffic = metrics.total > 0;

    const card = document.createElement('div');
    card.className = `bpmn-overlay-metrics estado-${themeClass}${hasTraffic ? ' has-traffic' : ''}`;

    card.innerHTML = `
      <div class="om-header" style="min-width: 80px;">
        <div class="om-row om-main">
          <span class="om-count">${metrics.total}</span>
          <span class="om-label">${metrics.total === 1 ? 'Ticket' : 'Tickets'}</span>
        </div>
      </div>
      <div class="om-details">
        ${metrics.urgentes > 0 ? `<div class="om-row om-warn"><span class="om-icon">!</span> ${metrics.urgentes} URGENTE</div>` : ''}
        ${metrics.slaCritico > 0 ? `<div class="om-row om-danger"><span class="om-icon">X</span> ${metrics.slaCritico} VENCIDO</div>` : ''}
      </div>
    `;

    overlays.add(elementId, { 
      position: { top: -25, left: 10 }, 
      html: card 
    });
  }

  // ─── Departamentos Management Tab ───────────────────────────────────

  cargarDepartamentos() {
    this.loadingDepts.set(true);
    this.deptService.listarDepartamentos().subscribe({
      next: (data) => {
        this.departamentos.set(data);
        this.loadingDepts.set(false);
      },
      error: () => this.loadingDepts.set(false)
    });
  }

  crearDepartamento() {
    if (!this.newDeptNombre().trim() || this.creatingDept()) return;
    this.creatingDept.set(true);

    const req = {
      nombre: this.newDeptNombre().trim(),
      descripcion: this.newDeptDesc().trim() || undefined
    };

    this.deptService.crearDepartamento(req).subscribe({
      next: () => {
        this.creatingDept.set(false);
        this.newDeptNombre.set('');
        this.newDeptDesc.set('');
        this.cargarDepartamentos();
      },
      error: (err) => {
        this.creatingDept.set(false);
        alert(err.message || 'Error al crear departamento');
      }
    });
  }

  focusTask(taskId: string) {
    if (!this.modeler) return;
    try {
      const canvas = this.modeler.get('canvas');
      const elementRegistry = this.modeler.get('elementRegistry');
      const el = elementRegistry.get(taskId);
      if (el) {
        // Center the task in the viewport
        canvas.scrollToElement(el, { center: true });
        
        // Add the visual highlighted marker class
        canvas.addMarker(el.id, this.markerClass);
        setTimeout(() => {
          canvas.removeMarker(el.id, this.markerClass);
        }, 3000);

        // Highlight element border using bpmn-js selection service
        try {
          const selection = this.modeler.get('selection');
          selection.select(el);
        } catch {}
        
        // Synchronize and select in the UI properties panel
        this.selectedElement.set({
          id: el.id,
          name: el.businessObject?.name || el.id,
          type: el.type,
          estado: this.obtenerEstadoDesdeElemento(el.id)
        });
        
        this.cargarDocumentosDeEtapa(el.id);
      }
    } catch (err) {
      console.warn('Error focusing task shape on canvas', err);
    }
  }

  highlightLane(deptName: string) {
    if (!this.modeler) return;
    try {
      const canvas = this.modeler.get('canvas');
      const elementRegistry = this.modeler.get('elementRegistry');
      const modeling = this.modeler.get('modeling');
      const elementFactory = this.modeler.get('elementFactory');
      const elements = elementRegistry.getAll();
      
      // 1. Buscar únicamente un Carril (bpmn:Lane) o Participante (bpmn:Participant) con coincidencia de texto
      let match = elements.find((e: any) => 
        (e.type === 'bpmn:Lane' || e.type === 'bpmn:Participant') && 
        e.businessObject?.name?.toLowerCase().includes(deptName.toLowerCase())
      );

      if (match) {
        // Encontrado: Centrar, marcar y seleccionar
        canvas.scrollToElement(match, { center: true });
        canvas.addMarker(match.id, this.markerClass);
        setTimeout(() => {
          canvas.removeMarker(match.id, this.markerClass);
        }, 3000);

        try {
          const selection = this.modeler.get('selection');
          selection.select(match);
        } catch {}

        this.selectedElement.set({
          id: match.id,
          name: match.businessObject?.name || match.id,
          type: match.type,
          estado: this.obtenerEstadoDesdeElemento(match.id)
        });
        this.cargarDocumentosDeEtapa(match.id);
      } else {
        // Si el carril/piscina no existe, preguntar de inmediato al usuario para generarlo
        const generar = window.confirm(`El Carril/Piscina (Pool) para el departamento "${deptName}" no existe en el diagrama.\n\n¿Deseas generar el carril tipo piscina automáticamente y mover las tareas asignadas adentro?`);
        
        if (generar) {
          const rootElement = canvas.getRootElement();
          const viewbox = canvas.viewbox();
          
          const x = viewbox.x + (viewbox.width / 2) - 300;
          const y = viewbox.y + (viewbox.height / 2) - 125;
          
          // Crear un bpmn:Participant (Pool/Piscina)
          const participantShape = elementFactory.createShape({ type: 'bpmn:Participant' });
          modeling.createShape(participantShape, { x: x > 0 ? x : 100, y: y > 0 ? y : 100, width: 600, height: 250 }, rootElement);
          modeling.updateLabel(participantShape, deptName);
          
          this.hasUnsavedChanges.set(true);
          this.onDiagramChanged();

          // Buscar tareas existentes asignadas a este departamento para meterlas al carril
          const tasksToMove = elements.filter((e: any) => 
            (e.type === 'bpmn:UserTask' || e.type === 'bpmn:Task') && 
            this.getWfAttr(e.businessObject, 'departamento')?.toLowerCase() === deptName.toLowerCase()
          );
          
          tasksToMove.forEach((taskShape: any, index: number) => {
            const targetX = (x > 0 ? x : 100) + 120 + (index * 160);
            const targetY = (y > 0 ? y : 100) + 85;
            
            const deltaX = targetX - taskShape.x;
            const deltaY = targetY - taskShape.y;
            
            try {
              modeling.moveShape(taskShape, { x: deltaX, y: deltaY }, participantShape);
            } catch (err) {
              console.warn('Error al mover tarea al carril auto-generado:', err);
            }
          });
          
          if (tasksToMove.length > 0) {
            this.colorearNodos();
            this.parseAllXMLAttrs();
          }

          canvas.scrollToElement(participantShape, { center: true });
          canvas.addMarker(participantShape.id, this.markerClass);
          setTimeout(() => {
            canvas.removeMarker(participantShape.id, this.markerClass);
          }, 3000);
          
          try {
            const selection = this.modeler.get('selection');
            selection.select(participantShape);
          } catch {}

          this.selectedElement.set({
            id: participantShape.id,
            name: deptName,
            type: participantShape.type,
            estado: 'PENDIENTE'
          });
          
          console.log(`[Workspace Pro] Carril (Participant) auto-generado para el departamento: ${deptName} y se movieron ${tasksToMove.length} tareas adentro.`);
        } else {
          // Si el usuario canceló la generación de la piscina, buscar y enfocar la primera tarea asignada (como fallback)
          let fallbackMatch = elements.find((e: any) => 
            (e.type === 'bpmn:UserTask' || e.type === 'bpmn:Task') && 
            e.businessObject?.$attrs?.['wf:departamento']?.toLowerCase() === deptName.toLowerCase()
          );
          
          if (!fallbackMatch) {
            fallbackMatch = elements.find((e: any) => 
              e.businessObject?.name?.toLowerCase().includes(deptName.toLowerCase())
            );
          }

          if (fallbackMatch) {
            canvas.scrollToElement(fallbackMatch, { center: true });
            canvas.addMarker(fallbackMatch.id, this.markerClass);
            setTimeout(() => {
              canvas.removeMarker(fallbackMatch.id, this.markerClass);
            }, 3000);

            try {
              const selection = this.modeler.get('selection');
              selection.select(fallbackMatch);
            } catch {}

            this.selectedElement.set({
              id: fallbackMatch.id,
              name: fallbackMatch.businessObject?.name || fallbackMatch.id,
              type: fallbackMatch.type,
              estado: this.obtenerEstadoDesdeElemento(fallbackMatch.id)
            });
            this.cargarDocumentosDeEtapa(fallbackMatch.id);
          } else {
            alert(`No se encontraron carriles ni tareas correspondientes al departamento "${deptName}".`);
          }
        }
      }
    } catch (e) {
      console.error("[Workspace Pro] Error al intentar generar carril:", e);
    }
  }

  getDeptWorkloadCount(deptName: string): number {
    return this.allTickets().filter(t => t.departamentoActual?.toLowerCase() === deptName.toLowerCase()).length;
  }

  obtenerSolicitudesDeDepto(deptName: string): SolicitudResponse[] {
    const user = this.authService.currentUser();
    if (!user) return [];

    const solicitudes = this.allTickets().filter(t => 
      t.departamentoActual?.toLowerCase() === deptName.toLowerCase()
    );

    if (user.rol === 'SOLICITANTE') {
      return solicitudes.filter(t => t.usuarioCreador === user.username);
    }

    return solicitudes;
  }

  localizarTicketEnCanvas(ticket: SolicitudResponse) {
    if (!this.modeler || !ticket.codigoSeguimiento) return;
    try {
      const canvas = this.modeler.get('canvas');
      const registry = this.modeler.get('elementRegistry');
      const elements = registry.getAll();
      const code = ticket.codigoSeguimiento;

      // 1. Intentar buscar una UserTask importada que coincida con el código de seguimiento
      let match = elements.find((e: any) =>
        (e.type === 'bpmn:UserTask' || e.type === 'bpmn:Task') &&
        e.businessObject?.name?.startsWith(`#${code}`)
      );

      // 2. Si no coincide, buscar por el mapeo de estado
      if (!match && ticket.estado) {
        const elementId = this.estadoElementoMap[ticket.estado as EstadoWorkflow];
        if (elementId) {
          match = registry.get(elementId);
        }
      }

      // 3. Si sigue sin coincidir, buscar el carril o piscina del departamento
      if (!match && ticket.departamentoActual) {
        match = elements.find((e: any) =>
          (e.type === 'bpmn:Participant' || e.type === 'bpmn:Lane') &&
          e.businessObject?.name?.toLowerCase().includes(ticket.departamentoActual!.toLowerCase())
        );
      }

      if (match) {
        canvas.scrollToElement(match, { center: true });
        canvas.addMarker(match.id, this.markerClass);
        setTimeout(() => {
          canvas.removeMarker(match.id, this.markerClass);
        }, 3000);

        try {
          const selection = this.modeler.get('selection');
          selection.select(match);
        } catch {}

        this.selectedElement.set({
          id: match.id,
          name: match.businessObject?.name || match.id,
          type: match.type,
          estado: this.obtenerEstadoDesdeElemento(match.id)
        });
        this.cargarDocumentosDeEtapa(match.id);
      } else {
        alert(`No se pudo encontrar una tarea específica para la solicitud ${code} en el lienzo.`);
      }
    } catch (e) {
      console.error('Error localizando ticket en canvas', e);
    }
  }

  obtenerDocumentosEtapaFiltrados(): Documento[] {
    const user = this.authService.currentUser();
    const docs = this.selectedElementDocs();
    if (!user) return [];

    if (user.rol === 'SOLICITANTE') {
      const misSolicitudesIds = this.allTickets()
        .filter(t => t.usuarioCreador === user.username)
        .map(t => t.id)
        .filter(Boolean) as string[];

      return docs.filter(d => 
        d.creadoPor === user.username || 
        misSolicitudesIds.includes(d.solicitudId)
      );
    }
    return docs;
  }

  // ─── Documentos Management Tab ──────────────────────────────────────

  cargarDocumentos() {
    this.loadingDocs.set(true);
    this.docService.listarTodos().subscribe({
      next: (data) => {
        this.documentos.set(data);
        this.loadingDocs.set(false);
      },
      error: () => this.loadingDocs.set(false)
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  crearDocumento() {
    if (this.docForm.invalid || this.submittingDoc()) return;
    const { nombre, descripcion, contenidoInicial } = this.docForm.value;

    this.submittingDoc.set(true);
    
    const activeEl = this.selectedElement();
    const stageId = activeEl?.id || 'bpmn-central';

    if (this.tipoCreacion() === 'FILE') {
      if (!this.selectedFile) {
        this.submittingDoc.set(false);
        return;
      }
      this.docService.crearDocumentoArchivo(stageId, nombre!, descripcion || '', this.selectedFile).subscribe({
        next: (doc) => {
          this.submittingDoc.set(false);
          this.showModalCrearDoc.set(false);
          this.selectedDoc.set(doc);
          this.cargarDocumentos();
          if (activeEl && activeEl.id) {
            this.cargarDocumentosDeEtapa(activeEl.id);
          }
        },
        error: () => this.submittingDoc.set(false)
      });
    } else {
      this.docService.crearDocumentoColaborativo(stageId, nombre!, descripcion || '', contenidoInicial || '').subscribe({
        next: (doc) => {
          this.submittingDoc.set(false);
          this.showModalCrearDoc.set(false);
          this.selectedDoc.set(doc);
          this.cargarDocumentos();
          if (activeEl && activeEl.id) {
            this.cargarDocumentosDeEtapa(activeEl.id);
          }
        },
        error: () => this.submittingDoc.set(false)
      });
    }
  }

  // Built-in focused overlay triggers
  abrirVisorEnfoque(doc: Documento) {
    this.selectedDoc.set(doc);
    this.visorActivo.set(true);
  }

  abrirEditorEnfoque(doc: Documento) {
    this.router.navigate(['/documentos/editar', doc.id]);
  }

  guardarBorradorColaborativo() {
    const doc = this.selectedDoc();
    if (!doc) return;

    this.docService.actualizarContenido(doc.id, this.contenidoEditor).subscribe({
      next: (updated) => {
        this.selectedDoc.set(updated);
        this.cargarDocumentos();
        alert('Borrador guardado exitosamente.');
      }
    });
  }

  cerrarEditorEnfoque() {
    const doc = this.selectedDoc();
    if (doc) {
      this.docService.desbloquearDocumento(doc.id).subscribe({
        next: () => {
          this.editorActivo.set(false);
          this.cargarDocumentos();
        },
        error: () => {
          this.editorActivo.set(false);
          this.cargarDocumentos();
        }
      });
    } else {
      this.editorActivo.set(false);
    }
  }

  abrirModalSnapshot() {
    this.comentarioSnapshot = '';
    this.modalSnapshot.set(true);
  }

  cerrarModalSnapshot() {
    this.modalSnapshot.set(false);
  }

  confirmarSnapshot() {
    const doc = this.selectedDoc();
    if (!doc || !this.comentarioSnapshot.trim()) return;

    this.docService.guardarSnapshot(doc.id, this.comentarioSnapshot).subscribe({
      next: (updated) => {
        this.selectedDoc.set(updated);
        this.modalSnapshot.set(false);
        this.cargarDocumentos();
        alert('Snapshot de versión publicado exitosamente.');
      }
    });
  }

  esPdf(mime?: string): boolean {
    return !!mime && mime.toLowerCase().includes('pdf');
  }

  getPdfUrl(nombreAlmacenado?: string): SafeResourceUrl {
    const url = `${this.basePath}/api/v1/archivos/${nombreAlmacenado}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  getFileTypeLabel(contentType?: string): string {
    if (!contentType) return 'DOC';
    if (contentType.includes('pdf')) return 'PDF';
    if (contentType.includes('image')) return 'IMG';
    if (contentType.includes('word') || contentType.includes('officedocument')) return 'WORD';
    return 'FILE';
  }

  // ─── Diagram Actions ───────────────────────────────────────────────

  zoomFit() {
    if (!this.modeler) return;
    this.modeler.get('canvas').zoom('fit-viewport', 'auto');
  }

  async exportPDF() {
    this.exportMenuOpen.set(false);
    this.zoomFit();
    
    setTimeout(async () => {
      if (!this.modeler) return;
      try {
        const { svg } = await this.modeler.saveSVG();
        this.exportService.generarPdf(svg, {
          version: this.diagramVersion(),
          total: this.allTickets().length,
          kpis: this.kpis().map(k => ({ label: k.label, count: k.count }))
        });
      } catch (err) {
        console.error('BPMN export error:', err);
      }
    }, 300);
  }

  async exportSVG() {
    this.exportMenuOpen.set(false);
    if (!this.modeler) return;
    try {
      const { svg } = await this.modeler.saveSVG();
      this.downloadBlob(svg, 'workflow-bpmn.svg', 'image/svg+xml');
    } catch (e) { console.error(e); }
  }

  async exportXML() {
    this.exportMenuOpen.set(false);
    if (!this.modeler) return;
    try {
      const { xml } = await this.modeler.saveXML({ format: true });
      this.downloadBlob(xml, 'workflow-bpmn.xml', 'application/xml');
    } catch (e) { console.error(e); }
  }

  private downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  colorearNodos() {
    if (!this.modeler) return;
    try {
      const modeling = this.modeler.get('modeling');
      const registry = this.modeler.get('elementRegistry');
      const elements = registry.getAll();
      
      const toColor = elements.filter((e: any) => 
        e.type !== 'label' && 
        e.type !== 'bpmn:Process' && 
        e.type !== 'bpmn:Collaboration' &&
        e.type !== 'bpmn:Participant'
      );

      if (toColor.length > 0) {
        modeling.setColor(toColor, { 
          fill: '#ffffff',
          stroke: 'var(--theme-slate-500)' 
        });
      }

      const estadoColores: Record<EstadoWorkflow, { fill: string, stroke: string }> = {
        PENDIENTE: { fill: '#fffbeb', stroke: '#f59e0b' },
        EN_REVISION: { fill: '#eff6ff', stroke: '#3b82f6' },
        APROBADO: { fill: '#f0fdf4', stroke: '#22c55e' },
        RECHAZADO: { fill: '#fef2f2', stroke: '#ef4444' },
        BLOQUEADO: { fill: '#fef2f2', stroke: '#ef4444' },
        SLA_CRITICO: { fill: '#fff1f2', stroke: '#e11d48' }
      };

      // 1. Color standard flow state elements
      Object.entries(this.estadoElementoMap).forEach(([estado, elementId]) => {
        const element = registry.get(elementId);
        if (element) {
          const color = estadoColores[estado as EstadoWorkflow];
          if (color) {
            modeling.setColor([element], color);
          }
        }
      });

      // 2. Overlay dynamic Attention and Dependency colors from the Workspace Memory Graph!
      const graph = this.memory.graphCache();
      elements.forEach((e: any) => {
        if (!e.businessObject || e.type === 'label') return;
        const name = e.businessObject.name?.toLowerCase() || '';

        // Match node in the local memory cache by ID or textual name match
        const graphNode = graph.nodes.find(n => 
          n.id === e.id || 
          name.includes(n.title.toLowerCase()) || 
          n.title.toLowerCase().includes(name)
        );

        if (graphNode) {
          const state = graphNode.state;
          if (state === 'SLA_CRITICAL' || state === 'SLA_CRITICO') {
            modeling.setColor([e], { fill: '#fff1f2', stroke: '#e11d48' });
          } else if (state === 'BLOCKED' || state === 'BLOQUEADO') {
            modeling.setColor([e], { fill: '#fef2f2', stroke: '#ef4444' });
          } else if (state === 'APROBADO' || state === 'PUBLISHED') {
            modeling.setColor([e], { fill: '#f0fdf4', stroke: '#22c55e' });
          } else if (state === 'EN_REVISION' || state === 'REVISION') {
            modeling.setColor([e], { fill: '#eff6ff', stroke: '#3b82f6' });
          } else if (state === 'RECHAZADO') {
            modeling.setColor([e], { fill: '#fef2f2', stroke: '#ef4444' });
          } else if (state === 'PENDIENTE') {
            modeling.setColor([e], { fill: '#fffbeb', stroke: '#f59e0b' });
          }
        }
      });

      // 3. Aislar Departamento
      const deptoAislado = this.departamentoAislado();
      if (deptoAislado) {
        elements.forEach((e: any) => {
          if ((e.type === 'bpmn:UserTask' || e.type === 'bpmn:Task') && e.businessObject) {
            const depto = this.getWfAttr(e.businessObject, 'departamento') || '';
            if (depto.toLowerCase() !== deptoAislado.toLowerCase()) {
              modeling.setColor([e], { fill: '#f8fafc', stroke: '#cbd5e1' });
            }
          }
        });
      }
    } catch (e) {
      console.warn('[BPMN Highlighting] Failed overlaying graph state', e);
    }
  }

  private formatearHora(date: Date): string {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(date);
  }

  public obtenerEstadoDesdeElemento(elementId: string): EstadoWorkflow {
    const node = this.memory.graphCache().nodes.find(n => n.id === elementId);
    if (!node) return 'PENDIENTE';
    const state = node.state;
    if (state === 'BLOCKED' || state === 'BLOQUEADO') return 'BLOQUEADO';
    if (state === 'SLA_CRITICAL' || state === 'SLA_CRITICO') return 'SLA_CRITICO';
    if (state === 'APROBADO' || state === 'PUBLISHED') return 'APROBADO';
    if (state === 'EN_REVISION' || state === 'REVISION') return 'EN_REVISION';
    if (state === 'RECHAZADO') return 'RECHAZADO';
    return 'PENDIENTE';
  }

  private extraerMensajeError(error: any): string {
    if (error?.error?.mensaje && typeof error.error.mensaje === 'string') return error.error.mensaje;
    if (typeof error?.error === 'string' && error.error.trim()) return error.error;
    if (typeof error?.message === 'string' && error.message.trim()) return error.message;
    return 'Error al sincronizar.';
  }

  isElementBlocked(elementId: string): boolean {
    const node = this.memory.graphCache().nodes.find(n => n.id === elementId);
    return node ? node.state === 'BLOCKED' : false;
  }

  toggleElementBlock(elementId: string, elementName: string) {
    const current = this.memory.graphCache().nodes.find(n => n.id === elementId);
    const newState = (current && current.state === 'BLOCKED') ? 'PUBLISHED' : 'BLOCKED';

    this.memory.updateGraphNode({
      id: elementId,
      title: elementName || 'Tarea BPMN',
      type: 'TASK',
      state: newState
    });

    // Refresh color markers on the canvas immediately
    setTimeout(() => this.colorearNodos(), 200);
  }

  listarDefiniciones() {
    this.supportService.listarWorkflowDefinitions().subscribe({
      next: (defs: any) => {
        this.definitions.set(defs);
      },
      error: (err: any) => console.error('Failed to list workflows', err)
    });
  }

  async cambiarWorkflowSeleccionado(key: string) {
    if (this.hasUnsavedChanges()) {
      if (!confirm('Tienes cambios sin guardar. ¿Deseas cambiar de workflow de todas formas?')) {
        return;
      }
    }
    this.selectedWorkflowKey.set(key);
    this.saveMessage.set('Cargando workflow...');
    
    this.supportService.obtenerWorkflowDefinition(key).subscribe({
      next: async (def: any) => {
        if (def && def.xml) {
          await this.modeler.importXML(def.xml);
          this.diagramVersion.set(def.version || 1);
          this.lastEditor.set(def.editadoPor || '');
        } else {
          await this.modeler.importXML(WORKFLOW_BPMN_XML);
          this.diagramVersion.set(1);
          this.lastEditor.set('');
        }
        this.colorearNodos();
        this.parseAllXMLAttrs();
        this.hasUnsavedChanges.set(false);
        this.saveMessage.set('');
      },
      error: async (err: any) => {
        console.error('Error fetching workflow definition', err);
        await this.modeler.importXML(WORKFLOW_BPMN_XML);
        this.hasUnsavedChanges.set(false);
        this.saveMessage.set('');
      }
    });
  }

  abrirModalNuevoProceso() {
    this.nuevoProcesoForm.reset();
    this.showModalNuevoProceso.set(true);
  }

  crearNuevoProceso() {
    if (this.nuevoProcesoForm.invalid || this.submittingNuevoProceso()) return;
    this.submittingNuevoProceso.set(true);

    const { name, key, description } = this.nuevoProcesoForm.value;
    const myUser = this.authService.currentUser()?.username || 'Usuario';
    const myDept = this.authService.currentUser()?.departamento || '';

    const defPayload = {
      key: key!,
      name: name!,
      description: description || '',
      xml: WORKFLOW_BPMN_XML,
      comentario: 'Proceso inicial creado desde el Diseñador'
    };

    this.supportService.guardarWorkflowDefinition(defPayload, myUser, myDept).subscribe({
      next: (saved: any) => {
        this.submittingNuevoProceso.set(false);
        this.showModalNuevoProceso.set(false);
        this.listarDefiniciones();
        this.cambiarWorkflowSeleccionado(saved.key);
      },
      error: (err: any) => {
        this.submittingNuevoProceso.set(false);
        alert('Error al crear el proceso: ' + this.extraerMensajeError(err));
      }
    });
  }

  obtenerDeptoAsignado(elementId: string): string {
    if (!this.modeler) return '';
    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const el = elementRegistry.get(elementId);
      return this.getWfAttr(el?.businessObject, 'departamento') || '';
    } catch {}
    return '';
  }

  asignarDepartamentoATarea(elementId: string, deptoNombre: string) {
    const el = this.selectedElement();
    if (!el || !el.id || !this.modeler) return;

    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const modeling = this.modeler.get('modeling');
      const shape = elementRegistry.get(el.id);

      if (shape && shape.businessObject) {
        this.setWfAttr(shape, 'departamento', deptoNombre);

        // Force UI update
        this.selectedElement.set({ ...el });
        
        // Trigger auto-save if enabled
        this.onDiagramChanged();
      }
    } catch (e) {
      console.error('Error assigning department to task', e);
    }
  }

  onDiagramChanged() {
    if (this.autosaveEnabled()) {
      if (this.autosaveDebounce) {
        clearTimeout(this.autosaveDebounce);
      }
      this.autosaveDebounce = setTimeout(() => {
        if (this.autosaveEnabled() && this.hasUnsavedChanges()) {
          console.log('[Autosave] Triggering automatic save...');
          this.guardarDiagrama('Autoguardado automático');
        }
      }, 5000);
    }
  }

  cargarDocumentosDeEtapa(etapaId: string) {
    if (!etapaId) {
      this.selectedElementDocs.set([]);
      this.formFields.set([]);
      return;
    }
    this.loadingElementDocs.set(true);

    // Cargar campos del formulario desde los atributos del XML BPMN
    this.formFields.set(this.getFormFieldsFromElement(etapaId));

    const esBpmn = etapaId.startsWith('Activity_') || 
                   etapaId.startsWith('Event_') || 
                   etapaId.startsWith('Gateway_') || 
                   etapaId === 'bpmn-central' ||
                   etapaId.startsWith('bpmn-');

    const obs$ = esBpmn 
      ? this.docService.listarPorTarea(etapaId) 
      : this.docService.listarPorSolicitud(etapaId);

    obs$.subscribe({
      next: (docs) => {
        this.selectedElementDocs.set(docs || []);
        this.loadingElementDocs.set(false);
      },
      error: (err) => {
        console.error('Error listing documents of stage/solicitud', err);
        this.selectedElementDocs.set([]);
        this.loadingElementDocs.set(false);
      }
    });
  }

  getFormFieldsFromElement(elementId: string): FormFieldDefinition[] {
    if (!this.modeler) return [];
    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const el = elementRegistry.get(elementId);
      const formData = this.getWfAttr(el?.businessObject, 'form');
      if (formData) {
        return JSON.parse(formData);
      }
    } catch (e) {
      console.warn('Error parsing wf:form attribute', e);
    }
    return [];
  }

  saveFormFieldsToElement(fields: FormFieldDefinition[]) {
    const el = this.selectedElement();
    if (!el || !this.modeler) return;

    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const modeling = this.modeler.get('modeling');
      const shape = elementRegistry.get(el.id);

      if (shape?.businessObject) {
        this.setWfAttr(shape, 'form', JSON.stringify(fields));
        
        this.formFields.set([...fields]);
        this.hasUnsavedChanges.set(true);
      }
    } catch (e) {
      console.error('Error saving form fields to BPMN', e);
    }
  }

  addFormField() {
    const current = this.formFields();
    const newField: FormFieldDefinition = {
      name: 'campo_' + (current.length + 1),
      label: 'Nuevo Campo',
      type: 'text',
      required: false,
      placeholder: 'Ingrese valor...'
    };
    this.saveFormFieldsToElement([...current, newField]);
  }

  updateFormField(index: number, changes: Partial<FormFieldDefinition>) {
    const current = [...this.formFields()];
    current[index] = { ...current[index], ...changes };
    this.saveFormFieldsToElement(current);
  }

  removeFormField(index: number) {
    const current = this.formFields();
    this.saveFormFieldsToElement(current.filter((_, i) => i !== index));
  }


  cambiarEstadoEtapa(elementId: string, nuevoEstado: string) {
    const el = this.selectedElement();
    if (!el || !el.id) return;

    this.memory.updateGraphNode({
      id: elementId,
      title: el.name || 'Tarea BPMN',
      type: 'TASK',
      state: nuevoEstado
    });

    const estadoCast = nuevoEstado as EstadoWorkflow;

    // Update local state directly
    this.selectedElement.update(prev => prev ? { ...prev, estado: estadoCast } : null);

    // Color canvas nodes immediately
    setTimeout(() => this.colorearNodos(), 200);
  }

  obtenerTareasDeDepto(deptoNombre: string): { id: string, name: string, type: string, estado: string }[] {
    if (!this.modeler) return [];
    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const elements = elementRegistry.getAll();
      return elements
        .filter((e: any) => 
          (e.type === 'bpmn:UserTask' || e.type === 'bpmn:Task') && e.businessObject
        )
        .map((e: any) => {
          const id = e.id;
          const name = e.businessObject.name || id;
          const assignedDepto = this.getWfAttr(e.businessObject, 'departamento') || '';
          const estado = this.obtenerEstadoDesdeElemento(id);
          return { id, name, type: e.type, depto: assignedDepto, estado };
        })
        .filter((t: any) => t.depto.toLowerCase() === deptoNombre.toLowerCase());
    } catch (err) {
      console.warn('Error reading department tasks from modeler', err);
      return [];
    }
  }

  alternarAislamientoDepartamento(deptoNombre: string) {
    if (this.departamentoAislado() === deptoNombre) {
      this.departamentoAislado.set(null);
    } else {
      this.departamentoAislado.set(deptoNombre);
    }
    this.colorearNodos();
  }

  crearYColocarTarea(deptoNombre: string) {
    if (!this.modeler) return;
    try {
      const elementFactory = this.modeler.get('elementFactory');
      const modeling = this.modeler.get('modeling');
      const elementRegistry = this.modeler.get('elementRegistry');

      // 1. Obtener elemento padre (Process)
      const parent = elementRegistry.get('Process_1') || elementRegistry.getAll().find((e: any) => e.type === 'bpmn:Process');
      if (!parent) {
        alert('No se pudo encontrar el proceso principal del diagrama');
        return;
      }

      // 2. Pedir nombre de la tarea al usuario
      const taskName = prompt(`Ingrese el nombre de la nueva tarea para el departamento de ${deptoNombre}:`, `Tarea en ${deptoNombre}`);
      if (!taskName) return;

      // 3. Crear shape de UserTask
      const taskShape = elementFactory.createShape({
        type: 'bpmn:UserTask'
      });

      // 4. Configurar propiedades básicas y personalizadas
      taskShape.businessObject.name = taskName;
      this.setWfAttr(taskShape, 'departamento', deptoNombre);

      // 5. Calcular posición libre para la tarea
      const existingTasks = elementRegistry.getAll().filter((e: any) => e.type === 'bpmn:UserTask' || e.type === 'bpmn:Task');
      const count = existingTasks.length;
      const x = 300 + (count * 160) % 480;
      const y = 150 + Math.floor((count * 160) / 480) * 120;

      // 6. Colocar la tarea en el lienzo
      modeling.createShape(taskShape, { x, y }, parent);

      // 7. Colorear y notificar cambios
      this.colorearNodos();
      this.parseAllXMLAttrs();
      this.hasUnsavedChanges.set(true);

      // Si el autoguardado está activo, guardar
      if (this.autosaveEnabled()) {
        this.guardarDiagrama('Tarea agregada programáticamente: ' + taskName);
      }
    } catch (err) {
      console.error('Error al agregar tarea programáticamente', err);
      alert('Error al agregar la tarea: ' + err);
    }
  }

  enviarSolicitudesAlDiagrama(deptoNombre: string) {
    if (!this.modeler) return;
    try {
      const tickets = this.allTickets().filter(t => t.departamentoActual?.toLowerCase() === deptoNombre.toLowerCase());
      if (tickets.length === 0) {
        alert(`No hay solicitudes activas en cola para el departamento "${deptoNombre}".`);
        return;
      }

      const elementFactory = this.modeler.get('elementFactory');
      const modeling = this.modeler.get('modeling');
      const elementRegistry = this.modeler.get('elementRegistry');

      // Buscar si existe un carril/piscina para el departamento
      let parent = elementRegistry.getAll().find((e: any) => 
        (e.type === 'bpmn:Participant' || e.type === 'bpmn:Lane') && 
        e.businessObject?.name?.toLowerCase().includes(deptoNombre.toLowerCase())
      );

      // Si no hay carril, usar el proceso raíz
      if (!parent) {
        parent = elementRegistry.get('Process_1') || elementRegistry.getAll().find((e: any) => e.type === 'bpmn:Process');
      }

      if (!parent) {
        alert('No se pudo encontrar un contenedor o proceso raíz en el diagrama.');
        return;
      }

      let countCreated = 0;
      tickets.forEach((ticket, idx) => {
        // Formatear nombre de la tarea basado en el código de seguimiento o ID corto y título de la solicitud
        const taskName = `#${ticket.codigoSeguimiento || ticket.id?.substring(0, 5)}: ${ticket.titulo}`;
        
        // Evitar duplicados
        const existingNode = elementRegistry.getAll().find((e: any) => 
          (e.type === 'bpmn:UserTask' || e.type === 'bpmn:Task') && 
          e.businessObject?.name === taskName
        );

        if (existingNode) {
          return;
        }

        const taskShape = elementFactory.createShape({
          type: 'bpmn:UserTask'
        });

        // Configurar metadatos del departamento
        taskShape.businessObject.name = taskName;
        this.setWfAttr(taskShape, 'departamento', deptoNombre);

        let posX = 300 + (idx * 160);
        let posY = 180;

        if (parent.type === 'bpmn:Participant') {
          // Si está en una piscina, colocar dentro de los límites visuales
          posX = parent.x + 120 + (idx * 160);
          posY = parent.y + 85;
        }

        modeling.createShape(taskShape, { x: posX, y: posY }, parent);
        countCreated++;
      });

      if (countCreated > 0) {
        this.colorearNodos();
        this.parseAllXMLAttrs();
        this.hasUnsavedChanges.set(true);
        if (this.autosaveEnabled()) {
          this.guardarDiagrama(`Importadas ${countCreated} solicitudes de ${deptoNombre} al diagrama`);
        }
        alert(`Se han importado exitosamente ${countCreated} solicitudes como tareas al diagrama.`);
      } else {
        alert('Todas las solicitudes de la cola de este departamento ya se encuentran representadas en el diagrama.');
      }
    } catch (err) {
      console.error('Error al enviar solicitudes al diagrama:', err);
      alert('Error al enviar solicitudes al diagrama: ' + err);
    }
  }

  // ─── Helpers para Atributos Personalizados (wf:namespace) ───────────────

  getWfAttr(businessObject: any, attrName: string): string | null {
    if (!businessObject) return null;
    // Intentar obtener de varias formas (según versión de moddle y namespace)
    return businessObject.get?.('wf:' + attrName) || 
           businessObject['wf:' + attrName] || 
           businessObject.$attrs?.['wf:' + attrName] || 
           null;
  }

  setWfAttr(shape: any, attrName: string, value: string | null) {
    if (!this.modeler || !shape) return;
    const modeling = this.modeler.get('modeling');
    
    // Usar modeling.updateProperties para asegurar que entre en el stack de cambios y XML
    this.isImporting = true;
    modeling.updateProperties(shape, {
      ['wf:' + attrName]: value
    });
    this.isImporting = false;
    this.hasUnsavedChanges.set(true);
    
    this.onDiagramChanged();
  }

  ensureAttrsExist(businessObject: any) {
    if (!businessObject) return;
    if (!businessObject.$attrs) {
      try {
        Object.defineProperty(businessObject, '$attrs', {
          value: {},
          writable: true,
          configurable: true,
          enumerable: true
        });
      } catch (err) {
        businessObject.$attrs = {};
      }
    }
  }

  toggleVoiceDiagramming() {
    if (this.voiceService.isListening()) {
      this.voiceService.stop();
    } else {
      this.voiceService.start();
    }
  }

  async procesarComandosVoz(transcripcion: string) {
    if (!this.modeler) return;
    this.voiceProcessingStatus.set('Analizando comandos por audio...');
    
    const prompt = `
[ROL] Eres el motor de parsing de lenguaje natural de Workflow.
Analiza la siguiente frase dictada por voz del usuario para generar elementos de proceso BPMN:
"${transcripcion}"

Determina qué elementos de proceso desea crear o conectar el usuario.
Retorna UNICAMENTE un objeto JSON en texto plano (sin bloques de código markdown, sin texto adicional) con la siguiente estructura:
{
  "action": "CREATE_ELEMENTS",
  "elements": [
    {
      "id": "task_1",
      "type": "task" | "gateway" | "start" | "end",
      "name": "Nombre descriptivo del elemento",
      "departamento": "Departamento opcional",
      "connectFrom": "id_de_otro_elemento_a_conectar_desde_el_que_viene"
    }
  ]
}

Ejemplos:
- "crea un inicio, luego una tarea de validación en Finanzas y conéctala a un fin"
{
  "action": "CREATE_ELEMENTS",
  "elements": [
    { "id": "start_1", "type": "start", "name": "Inicio" },
    { "id": "task_1", "type": "task", "name": "Validación", "departamento": "Finanzas", "connectFrom": "start_1" },
    { "id": "end_1", "type": "end", "name": "Fin", "connectFrom": "task_1" }
  ]
}
`;

    const request = {
      mensaje: prompt,
      usuarioId: this.authService.currentUser()?.username || 'voice-agent',
      sinHerramientas: true
    };

    this.aiService.enviarMensajeUsuario(request).subscribe({
      next: (response: any) => {
        try {
          const respText = response.datos?.respuesta || '';
          const jsonText = respText.replace(/```json/g, '').replace(/```/g, '').trim();
          const data = JSON.parse(jsonText);
          
          if (data.action === 'CREATE_ELEMENTS' && Array.isArray(data.elements)) {
            this.ejecutarCreacionDeElementosBPMN(data.elements);
          } else {
            this.voiceProcessingStatus.set('El comando de voz no fue reconocido.');
            setTimeout(() => this.voiceProcessingStatus.set(''), 3000);
          }
        } catch (err) {
          console.error('Error parseando JSON de voz', err);
          this.ejecutarParsingHeuristicoLocal(transcripcion);
        }
      },
      error: () => {
        this.ejecutarParsingHeuristicoLocal(transcripcion);
      }
    });
  }

  ejecutarParsingHeuristicoLocal(text: string) {
    this.voiceProcessingStatus.set('Usando interpretación local...');
    const low = text.toLowerCase();
    const elements: any[] = [];
    
    if (low.includes('inicio') || low.includes('comenzar')) {
      elements.push({ id: 'start_1', type: 'start', name: 'Inicio' });
    }
    
    const depto = low.includes('finanzas') ? 'Finanzas' : low.includes('operaciones') ? 'Operaciones' : undefined;
    
    if (low.includes('tarea') || low.includes('proceso')) {
      let name = 'Nueva Tarea';
      if (low.includes('tarea de')) {
        const parts = low.split('tarea de');
        if (parts[1]) name = parts[1].split('en')[0].split('luego')[0].trim();
      } else if (low.includes('tarea')) {
        const parts = low.split('tarea');
        if (parts[1]) name = parts[1].split('en')[0].split('luego')[0].trim();
      }
      
      const connectFrom = elements.length > 0 ? elements[elements.length - 1].id : undefined;
      elements.push({
        id: 'task_1',
        type: 'task',
        name: name.charAt(0).toUpperCase() + name.slice(1),
        departamento: depto,
        connectFrom
      });
    }
    
    if (low.includes('fin') || low.includes('terminar')) {
      const connectFrom = elements.length > 0 ? elements[elements.length - 1].id : undefined;
      elements.push({ id: 'end_1', type: 'end', name: 'Fin', connectFrom });
    }
    
    if (elements.length > 0) {
      this.ejecutarCreacionDeElementosBPMN(elements);
    } else {
      this.voiceProcessingStatus.set('No se reconoció ninguna orden en el audio.');
      setTimeout(() => this.voiceProcessingStatus.set(''), 3000);
    }
  }

  ejecutarCreacionDeElementosBPMN(elements: any[]) {
    try {
      this.voiceProcessingStatus.set('Graficando proceso en el lienzo...');
      const elementFactory = this.modeler.get('elementFactory');
      const modeling = this.modeler.get('modeling');
      const elementRegistry = this.modeler.get('elementRegistry');

      let parent = elementRegistry.get('Process_1') || elementRegistry.getAll().find((e: any) => e.type === 'bpmn:Process');
      if (!parent) {
        parent = this.modeler.get('canvas').getRootElement();
      }

      const createdShapes: Record<string, any> = {};
      let lastX = 200;
      let lastY = 200;

      const existingShapes = elementRegistry.getAll().filter((e: any) => 
        e.type === 'bpmn:UserTask' || e.type === 'bpmn:Task' || e.type === 'bpmn:StartEvent' || e.type === 'bpmn:EndEvent'
      );
      if (existingShapes.length > 0) {
        const maxX = Math.max(...existingShapes.map((e: any) => e.x || 0));
        if (maxX > 0) {
          lastX = maxX + 180;
        }
      }

      elements.forEach((el, idx) => {
        let shapeType = 'bpmn:UserTask';
        if (el.type === 'gateway') shapeType = 'bpmn:ExclusiveGateway';
        else if (el.type === 'start') shapeType = 'bpmn:StartEvent';
        else if (el.type === 'end') shapeType = 'bpmn:EndEvent';

        const shape = elementFactory.createShape({ type: shapeType });
        shape.businessObject.name = el.name;
        
        if (el.departamento) {
          this.setWfAttr(shape, 'departamento', el.departamento);
        }

        let posX = lastX;
        let posY = lastY;

        if (el.connectFrom && createdShapes[el.connectFrom]) {
          const source = createdShapes[el.connectFrom];
          posX = (source.x || 200) + 180;
          posY = source.y || 200;
        } else if (idx > 0) {
          posX = lastX + 180;
        }

        modeling.createShape(shape, { x: posX, y: posY }, parent);
        createdShapes[el.id] = shape;

        lastX = posX;
        lastY = posY;

        if (el.connectFrom && createdShapes[el.connectFrom]) {
          const source = createdShapes[el.connectFrom];
          modeling.connect(source, shape, { type: 'bpmn:SequenceFlow' });
        }
      });

      this.colorearNodos();
      this.parseAllXMLAttrs();
      this.hasUnsavedChanges.set(true);

      this.voiceProcessingStatus.set('¡Proceso graficado con éxito!');
      setTimeout(() => this.voiceProcessingStatus.set(''), 3000);

      this.onDiagramChanged();
    } catch (err) {
      console.error('Error al graficar elementos', err);
      this.voiceProcessingStatus.set('Error al graficar proceso.');
      setTimeout(() => this.voiceProcessingStatus.set(''), 3000);
    }
  }
}
