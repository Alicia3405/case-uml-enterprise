export type EstadoWorkflow = 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO';
export type EstadoSla = 'EN_TIEMPO' | 'POR_VENCER' | 'VENCIDO' | 'CERRADO';

export interface TransicionFlujo {
  id: string;
  desde: EstadoWorkflow;
  hacia: EstadoWorkflow;
  titulo: string;
  descripcion: string;
}

export interface DetalleEstado {
  estado: EstadoWorkflow;
  etiqueta: string;
  total: number;
  descripcion: string;
}

export interface DetalleTransicion extends TransicionFlujo {
  etiquetaDesde: string;
  etiquetaHacia: string;
  totalDestino: number;
}

export interface WorkflowNodeData {
  label: string;
  estado: EstadoWorkflow;
  count: number;
  color: string;
  iconPath: string;
}

export const ESTADO_POR_NODO_ID: Record<string, EstadoWorkflow> = {};
export const DESCRIPCION_ESTADO: Record<string, string> = {};
export const TRANSICIONES_POR_ARISTA: Record<string, any> = {};
export const ESTADO_VISUAL_CONFIG: Record<string, { color: string; bgColor: string; iconPath: string }> = {
  PENDIENTE: { color: '#64748b', bgColor: '#f1f5f9', iconPath: '' },
  EN_REVISION: { color: '#2563eb', bgColor: '#eff6ff', iconPath: '' },
  APROBADO: { color: '#16a34a', bgColor: '#f0fdf4', iconPath: '' },
  RECHAZADO: { color: '#dc2626', bgColor: '#fef2f2', iconPath: '' }
};


