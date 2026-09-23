import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { SelectionGestureEndedEvent } from 'ng-diagram';
import { FormBuilder } from '@angular/forms';
import { WorkflowDepartamentalService } from '../../api/api/workflowDepartamental.service';
import { SolicitudResponse } from '../../api/model/solicitudResponse';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { PresenciaResumen, PresenciaUsuario, WorkflowSupportService } from '../../workflow/workflow-support.service';
import { WorkflowDiagramService } from '../../workflow/workflow-diagram.service';
import {
  EstadoWorkflow,
  EstadoSla,
  TransicionFlujo,
  DetalleEstado,
  DetalleTransicion
} from '../../models/workflow.models';

// Components
import { FlowInspectorComponent } from '../../components/flow-inspector/flow-inspector.component';
import { DashboardHeaderComponent } from './components/dashboard-header.component';
import { DashboardOperativoComponent } from './components/dashboard-operativo.component';
import { DashboardRegistrosComponent } from './components/dashboard-registros.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DashboardHeaderComponent,
    DashboardOperativoComponent,
    DashboardRegistrosComponent,
    FlowInspectorComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private workflowService = inject(WorkflowDepartamentalService);
  private workflowSupportService = inject(WorkflowSupportService);
  private diagramService = inject(WorkflowDiagramService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  authService = inject(AuthService);

  private dataRefreshTimer: ReturnType<typeof setInterval> | null = null;

  solicitudesBase = signal<SolicitudResponse[]>([]);
  solicitudes = computed(() => {
    const estadoFiltrado = this.filtroEstadoTabla();
    const slaFiltrado = this.filtroSlaTabla();
    const base = this.solicitudesBase();

    let resultado = base;

    if (estadoFiltrado) {
      resultado = resultado.filter((solicitud) => solicitud.estado === estadoFiltrado);
    }

    if (slaFiltrado) {
      resultado = resultado.filter((solicitud) => solicitud.estadoSla === slaFiltrado);
    }

    return resultado;
  });

  metadata = signal<Record<string, any>>({});
  presenciaResumen = signal<PresenciaResumen | null>(null);
  private prioridadPeso: Record<string, number> = {
    URGENTE: 0,
    ALTA: 1,
    MEDIA: 2,
    BAJA: 3
  };
  private slaPeso: Record<EstadoSla, number> = {
    VENCIDO: 0,
    POR_VENCER: 1,
    EN_TIEMPO: 2,
    CERRADO: 3
  };

  readonly estadosFlujo: EstadoWorkflow[] = ['PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO'];
  readonly estadosSlaVisibles: EstadoSla[] = ['VENCIDO', 'POR_VENCER', 'EN_TIEMPO'];
  readonly estadosSlaFiltro: EstadoSla[] = ['VENCIDO', 'POR_VENCER', 'EN_TIEMPO', 'CERRADO'];

  diagramConfig = signal({
    nodeDraggingEnabled: false,
    viewportPanningEnabled: true,
    zoom: {
      min: 0.6,
      max: 1.8,
      wheelFactor: 0.05
    }
  });

  activeView = signal<'OPERATIVO' | 'REGISTROS'>('OPERATIVO');

  filtroEstadoTabla = signal<EstadoWorkflow | null>(null);
  filtroSlaTabla = signal<EstadoSla | null>(null);
  estadoSeleccionadoDiagrama = signal<EstadoWorkflow | null>(null);
  transicionSeleccionadaDiagrama = signal<TransicionFlujo | null>(null);

  contadoresEstado = computed<Record<EstadoWorkflow, number>>(() => {
    const base = this.solicitudesBase();
    const conteoDesdeSolicitudes: Record<EstadoWorkflow, number> = {
      PENDIENTE: 0,
      EN_REVISION: 0,
      APROBADO: 0,
      RECHAZADO: 0
    };

    for (const solicitud of base) {
      const estado = solicitud.estado as EstadoWorkflow | undefined;
      if (estado && estado in conteoDesdeSolicitudes) {
        conteoDesdeSolicitudes[estado] += 1;
      }
    }

    const desdeMetadata: Record<string, number> = this.obtenerConteoDesdeMetadata();
    const conteo: Record<string, number> = conteoDesdeSolicitudes;
    return {
      PENDIENTE: desdeMetadata['PENDIENTE'] ?? conteo['PENDIENTE'] ?? 0,
      EN_REVISION: desdeMetadata['EN_REVISION'] ?? conteo['EN_REVISION'] ?? 0,
      APROBADO: desdeMetadata['APROBADO'] ?? conteo['APROBADO'] ?? 0,
      RECHAZADO: desdeMetadata['RECHAZADO'] ?? conteo['RECHAZADO'] ?? 0
    };
  });

  contadoresSla = computed<Record<EstadoSla, number>>(() => {
    const base = this.solicitudesBase();
    const conteoDesdeSolicitudes: Record<EstadoSla, number> = {
      VENCIDO: 0,
      POR_VENCER: 0,
      EN_TIEMPO: 0,
      CERRADO: 0
    };

    for (const solicitud of base) {
      const estadoSla = solicitud.estadoSla as EstadoSla | undefined;
      if (estadoSla && estadoSla in conteoDesdeSolicitudes) {
        conteoDesdeSolicitudes[estadoSla] += 1;
      }
    }

    const desdeMetadata: Record<string, number> = this.obtenerConteoSlaDesdeMetadata();
    const conteo: Record<string, number> = conteoDesdeSolicitudes;
    return {
      VENCIDO: desdeMetadata['VENCIDO'] ?? conteo['VENCIDO'] ?? 0,
      POR_VENCER: desdeMetadata['POR_VENCER'] ?? conteo['POR_VENCER'] ?? 0,
      EN_TIEMPO: desdeMetadata['EN_TIEMPO'] ?? conteo['EN_TIEMPO'] ?? 0,
      CERRADO: desdeMetadata['CERRADO'] ?? conteo['CERRADO'] ?? 0
    };
  });

  totalSolicitudes = computed(() => this.solicitudesBase().length);

  totalUrgentes = computed(() =>
    this.solicitudesBase().filter((solicitud) => solicitud.prioridad === 'URGENTE').length
  );

  solicitudesEnRiesgo = computed(() => {
    const c = this.contadoresSla() as Record<string, number>;
    return (c['VENCIDO'] || 0) + (c['POR_VENCER'] || 0);
  });

  tasaCierre = computed(() => {
    const total = this.totalSolicitudes();
    if (total === 0) {
      return 0;
    }
    const c = this.contadoresSla() as Record<string, number>;
    return Math.round(((c['CERRADO'] || 0) / total) * 100);
  });

  promedioEventos = computed(() => {
    const base = this.solicitudesBase();
    if (base.length === 0) {
      return 0;
    }

    const totalEventos = base.reduce((acumulado, solicitud) => acumulado + (solicitud.totalEventos || 0), 0);
    return Number((totalEventos / base.length).toFixed(1));
  });

  topDepartamentos = computed(() => {
    const acumulado = new Map<string, { total: number; urgentes: number }>();

    for (const solicitud of this.solicitudesBase()) {
      const departamento = (solicitud.departamentoActual || 'Sin departamento').trim() || 'Sin departamento';
      const item = acumulado.get(departamento) ?? { total: 0, urgentes: 0 };
      item.total += 1;
      if (solicitud.prioridad === 'URGENTE') {
        item.urgentes += 1;
      }
      acumulado.set(departamento, item);
    }

    return Array.from(acumulado.entries())
      .map(([departamento, data]) => ({ departamento, ...data }))
      .sort((a, b) => {
        if (b.total !== a.total) {
          return b.total - a.total;
        }
        return b.urgentes - a.urgentes;
      })
      .slice(0, 5);
  });

  maxCargaDepartamentos = computed(() =>
    this.topDepartamentos().reduce((max, item) => Math.max(max, item.total), 0)
  );

  registrosCriticos = computed(() => {
    const orden = this.solicitudes();
    return orden
      .filter((solicitud) =>
        solicitud.estadoSla === 'VENCIDO'
        || solicitud.estadoSla === 'POR_VENCER'
        || solicitud.prioridad === 'URGENTE'
      )
      .slice(0, 6);
  });

  usuariosOnlineVisibles = computed<PresenciaUsuario[]>(() =>
    this.presenciaResumen()?.usuariosOnline?.slice(0, 6) ?? []
  );



  estadoObjetivoSeleccionado = computed<EstadoWorkflow | null>(() => {
    const estado = this.estadoSeleccionadoDiagrama();
    if (estado) {
      return estado;
    }
    return this.transicionSeleccionadaDiagrama()?.hacia ?? null;
  });

  solicitudObjetivoSeleccionada = computed<SolicitudResponse | null>(() => {
    const estado = this.estadoObjetivoSeleccionado();
    if (!estado) {
      return null;
    }
    return this.solicitudesBase().find((solicitud) => solicitud.estado === estado) ?? null;
  });

  /** Computed details for the inspector */
  detalleEstadoSeleccionado = computed<DetalleEstado | null>(() => {
    const estado = this.estadoSeleccionadoDiagrama();
    if (!estado) return null;
    return this.diagramService.buildDetalleEstado(estado, this.contadoresEstado());
  });

  detalleTransicionSeleccionada = computed<DetalleTransicion | null>(() => {
    const transicion = this.transicionSeleccionadaDiagrama();
    if (!transicion) return null;
    return this.diagramService.buildDetalleTransicion(transicion, this.contadoresEstado());
  });

  searchControl = this.fb.control('');

  ngOnInit() {
    this.cargarEstadisticas();
    this.cargarSolicitudes();
    this.cargarPresencia();

    this.dataRefreshTimer = setInterval(() => {
      this.cargarEstadisticas();
      this.cargarSolicitudes();
      this.cargarPresencia();
    }, 5000);
  }

  ngOnDestroy() {
    if (this.dataRefreshTimer) {
      clearInterval(this.dataRefreshTimer);
    }
  }

  cargarEstadisticas() {
    const user = this.authService.currentUser();
    if (!user) return;

    this.workflowService.obtenerEstadisticas().subscribe({
      next: (res) => {
        if (res.datos) {
          const currentMetadataJSON = JSON.stringify(this.metadata());
          const newMetadataJSON = JSON.stringify(res.datos);
          
          if (currentMetadataJSON !== newMetadataJSON) {
            this.metadata.set(res.datos);
          }
        }
      },
      error: (err) => console.error('Error fetching stats', err)
    });
  }

  cargarSolicitudes() {
    const user = this.authService.currentUser();
    if (!user) return;

    let obs;
    if (user.rol === 'SOLICITANTE') {
      obs = this.workflowService.listarPorUsuario(user.username);
    } else if (user.rol === 'REVISOR') {
      obs = this.workflowService.listarPorDepartamento(user.departamento);
    } else {
      obs = this.workflowService.listarTodas();
    }

    obs.subscribe({
      next: (res) => {
        if (res.datos) {
          const sorted = this.ordenarSolicitudes(res.datos);
          const currentBaseJSON = JSON.stringify(this.solicitudesBase());
          const newBaseJSON = JSON.stringify(sorted);
          
          if (currentBaseJSON !== newBaseJSON) {
            this.solicitudesBase.set(sorted);
          }
        }
      },
      error: (err) => console.error('Error fetching solicitudes', err)
    });
  }

  buscarSolicitudes() {
    const query = this.searchControl.value;
    if (!query || query.trim() === '') {
      this.cargarSolicitudes();
      return;
    }

    this.workflowService.buscarPorTitulo(query.trim()).subscribe({
      next: (res) => {
        if (res.datos && res.datos.length > 0) {
          this.solicitudesBase.set(this.ordenarSolicitudes(res.datos));
        } else {
          this.workflowService.obtenerPorCodigo(query.trim().toUpperCase()).subscribe({
            next: (resCod) => {
              if (resCod.datos) {
                this.solicitudesBase.set([resCod.datos as SolicitudResponse]);
              } else {
                this.solicitudesBase.set([]);
              }
            },
            error: () => this.solicitudesBase.set([])
          });
        }
      },
      error: (err) => console.error('Error searching', err)
    });
  }

  limpiarBusqueda() {
    this.searchControl.setValue('');
    this.cargarSolicitudes();
  }

  cambiarVista(view: 'OPERATIVO' | 'REGISTROS') {
    this.activeView.set(view);
  }

  filtrarEstadoDesdeOperativo(estado: EstadoWorkflow) {
    this.activeView.set('REGISTROS');
    this.aplicarFiltroEstado(estado);
  }

  cargarPresencia() {
    this.workflowSupportService.obtenerResumenPresencia().subscribe({
      next: (resumen) => this.presenciaResumen.set(resumen),
      error: () => {
        // Keep previous state when presence endpoint is temporarily unavailable.
      }
    });
  }

  onDiagramSelectionEnded(event: SelectionGestureEndedEvent) {
    if (event.nodes.length > 0) {
      const ultimoNodoSeleccionado = event.nodes.at(-1);
      if (!ultimoNodoSeleccionado) return;

      const estado = this.diagramService.getEstadoForNode(ultimoNodoSeleccionado.id);
      if (!estado) return;

      this.estadoSeleccionadoDiagrama.set(estado);
      this.transicionSeleccionadaDiagrama.set(null);
      return;
    }

    if (event.edges.length > 0) {
      const ultimaAristaSeleccionada = event.edges.at(-1);
      if (!ultimaAristaSeleccionada) return;

      const transicion = this.diagramService.getTransicionForEdge(ultimaAristaSeleccionada.id);
      if (!transicion) return;

      this.transicionSeleccionadaDiagrama.set(transicion);
      this.estadoSeleccionadoDiagrama.set(null);
      return;
    }

    this.limpiarSeleccionDiagrama();
  }

  aplicarFiltroEstado(estado: EstadoWorkflow) {
    if (this.filtroEstadoTabla() === estado) {
      this.filtroEstadoTabla.set(null);
    } else {
      this.filtroEstadoTabla.set(estado);
    }
  }

  aplicarFiltroSla(estadoSla: EstadoSla) {
    if (this.filtroSlaTabla() === estadoSla) {
      this.filtroSlaTabla.set(null);
    } else {
      this.filtroSlaTabla.set(estadoSla);
    }
  }

  limpiarFiltrosTabla() {
    this.filtroEstadoTabla.set(null);
    this.filtroSlaTabla.set(null);
  }

  limpiarSeleccionDiagrama() {
    this.estadoSeleccionadoDiagrama.set(null);
    this.transicionSeleccionadaDiagrama.set(null);
  }

  entrarAlEstadoDesdeSeleccion() {
    const estadoObjetivo = this.estadoObjetivoSeleccionado();
    if (!estadoObjetivo) return;
    this.activeView.set('REGISTROS');
    this.aplicarFiltroEstado(estadoObjetivo);
  }

  abrirSolicitudObjetivoSeleccionada() {
    const solicitud = this.solicitudObjetivoSeleccionada();
    if (!solicitud?.id) return;
    this.router.navigate(['/detalle', solicitud.id]);
  }

  private obtenerConteoDesdeMetadata(): Partial<Record<EstadoWorkflow, number>> {
    const data = this.metadata();
    const counts = data?.['porEstado'] || data || {};
    const estadoKeys: EstadoWorkflow[] = ['PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO'];

    const result: Partial<Record<EstadoWorkflow, number>> = {};
    for (const estado of estadoKeys) {
      const valor = counts[estado];
      if (typeof valor === 'number') {
        result[estado] = valor;
      }
    }

    return result;
  }

  private obtenerConteoSlaDesdeMetadata(): Partial<Record<EstadoSla, number>> {
    const data = this.metadata();
    const counts = data?.['porSla'] || {};
    const slaKeys: EstadoSla[] = ['VENCIDO', 'POR_VENCER', 'EN_TIEMPO', 'CERRADO'];

    const result: Partial<Record<EstadoSla, number>> = {};
    for (const estadoSla of slaKeys) {
      const valor = counts[estadoSla];
      if (typeof valor === 'number') {
        result[estadoSla] = valor;
      }
    }

    return result;
  }

  private ordenarSolicitudes(solicitudes: SolicitudResponse[]): SolicitudResponse[] {
    return [...solicitudes].sort((a, b) => {
      const slaA = (a.estadoSla as EstadoSla | undefined) ?? 'EN_TIEMPO';
      const slaB = (b.estadoSla as EstadoSla | undefined) ?? 'EN_TIEMPO';
      const pesoSlaA = this.slaPeso[slaA] ?? 99;
      const pesoSlaB = this.slaPeso[slaB] ?? 99;
      if (pesoSlaA !== pesoSlaB) {
        return pesoSlaA - pesoSlaB;
      }

      const pesoA = this.prioridadPeso[a.prioridad || 'MEDIA'] ?? 99;
      const pesoB = this.prioridadPeso[b.prioridad || 'MEDIA'] ?? 99;
      if (pesoA !== pesoB) {
        return pesoA - pesoB;
      }

      const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
      const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
      return fechaB - fechaA;
    });
  }

}
