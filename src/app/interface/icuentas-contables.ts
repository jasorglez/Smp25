export interface ICuentaContable {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  nivel: number;
  idPadre?: number;
  esHoja: boolean;
  activo: boolean;
  idCompany: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICuentaContableHierarchy extends ICuentaContable {
  rutaCompleta: string;
  sortPath: string;
  montoDirecto: number;
  montoAcumulado: number;
}

export interface ICuentaContableTree extends ICuentaContable {
  hijos: ICuentaContableTree[];
  expanded?: boolean;
  visible?: boolean;
}

export interface ICuentaContableForm {
  id?: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  nivel: number;
  idPadre?: number;
  esHoja: boolean;
  activo: boolean;
  idCompany: number;
}
