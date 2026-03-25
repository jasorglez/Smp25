// ============================================================
// Interfaces — Módulo Presupuestos SIAF
// ============================================================

/** Encabezado de presupuesto / versión */
export interface IPresupuesto {
  id: number;
  id_project: number;
  numrevision: number;
  nombre: string;             // "Rev.0", "Rev.1" ...
  motivo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  vigente: boolean;
  usuario_responsable?: string;
  id_version_anterior?: number;
  idCompany: number;
  fecha_creacion?: string;
  active: boolean;
  // Calculados desde el API
  monto_total?: number;
  proyecto_nombre?: string;
}

/** Línea de detalle por cuenta / subcuenta */
export interface IPresupuestoLinea {
  id: number;
  id_presupuesto: number;
  id_cuenta: number;
  descripcion?: string;
  monto: number;
  active: boolean;
  // Enriquecidos desde cuentascontables
  cuenta_codigo?: string;
  cuenta_nombre?: string;
  cuenta_nivel?: number;
  cuenta_es_hoja?: boolean;
  // Calculados para reporte
  monto_preregistrado?: number;
  monto_ejecutado?: number;
  saldo_disponible?: number;
  pct_ejecucion?: number;
}

/** Distribución mensual por línea */
export interface IPresupuestoMes {
  id?: number;
  id_linea: number;
  mes: number;        // 1-12
  anio: number;
  monto: number;
  active: boolean;
  // UI helper
  seleccionado?: boolean;
}

/** Formulario para crear/editar un presupuesto */
export interface IPresupuestoForm {
  id?: number;
  id_project: number;
  numrevision: number;
  nombre: string;
  motivo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  vigente: boolean;
  idCompany: number;
  active: boolean;
  lineas?: IPresupuestoLineaForm[];
}

/** Formulario para línea de presupuesto */
export interface IPresupuestoLineaForm {
  id?: number;
  id_presupuesto?: number;
  id_cuenta: number;
  descripcion?: string;
  monto: number;
  active: boolean;
  meses?: IPresupuestoMes[];
}

/** Preregistro de gasto comprometido */
export interface IPreregistroGasto {
  id: number;
  id_project: number;
  id_cuenta: number;
  concepto: string;
  monto: number;
  fecha: string;
  usuario?: string;
  idCompany: number;
  fecha_creacion?: string;
  active: boolean;
  // Enriquecidos
  cuenta_codigo?: string;
  cuenta_nombre?: string;
  proyecto_nombre?: string;
}

/** Migración de monto entre cuentas */
export interface IPresupuestoMigracion {
  id: number;
  id_presupuesto_nuevo: number;
  id_cuenta_origen: number;
  id_cuenta_destino: number;
  monto_transferido: number;
  motivo?: string;
  usuario?: string;
  fecha: string;
  active: boolean;
  // Enriquecidos
  cuenta_origen_nombre?: string;
  cuenta_destino_nombre?: string;
}

/** Formulario para solicitar migración */
export interface IMigracionForm {
  id_presupuesto_vigente: number;
  id_cuenta_origen: number;
  id_cuenta_destino: number;
  monto_transferido: number;
  motivo: string;
  usuario: string;
  idCompany: number;
}

/** Solicitud de incremento de presupuesto */
export interface IPresupuestoIncremento {
  id: number;
  id_presupuesto: number;
  id_cuenta: number;
  monto_solicitado: number;
  motivo?: string;
  estado: 'pendiente' | 'autorizado' | 'rechazado';
  usuario_solicito?: string;
  usuario_autorizo?: string;
  fecha_solicitud: string;
  fecha_autorizacion?: string;
  active: boolean;
  // Enriquecidos
  cuenta_nombre?: string;
}

/** Reporte de desempeño presupuestal */
export interface IReporteDesempeno {
  id_cuenta: number;
  cuenta_codigo: string;
  cuenta_nombre: string;
  cuenta_nivel: number;
  monto_planeado: number;
  monto_ejecutado: number;     // suma de expenditure
  monto_preregistrado: number; // suma de preregistro_gasto
  variacion: number;           // planeado - ejecutado
  pct_ejecucion: number;       // ejecutado / planeado * 100
  // Hijos para árbol
  hijos?: IReporteDesempeno[];
}

/** Constantes de meses para la UI */
export const MESES = [
  { num: 1,  nombre: 'Enero' },
  { num: 2,  nombre: 'Febrero' },
  { num: 3,  nombre: 'Marzo' },
  { num: 4,  nombre: 'Abril' },
  { num: 5,  nombre: 'Mayo' },
  { num: 6,  nombre: 'Junio' },
  { num: 7,  nombre: 'Julio' },
  { num: 8,  nombre: 'Agosto' },
  { num: 9,  nombre: 'Septiembre' },
  { num: 10, nombre: 'Octubre' },
  { num: 11, nombre: 'Noviembre' },
  { num: 12, nombre: 'Diciembre' },
];
