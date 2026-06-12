export interface IObjectClassifier {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  nivel: number;
  idPadre?: number;
  esHoja: boolean;
  idCompany: number;
  createdAt?: string;
  updatedAt?: string;
  active: boolean;
}

export interface IObjectClassifierTree extends IObjectClassifier {
  hijos: IObjectClassifierTree[];
  expanded?: boolean;
  dataPath?: string[];
  hasChildren?: boolean;
  __isNew?: boolean;
  __modified?: boolean;
}

export interface IObjectClassifierForm {
  codigo: string;
  nombre: string;
  descripcion: string;
  nivel: number;
  idPadre?: number;
  esHoja: boolean;
  idCompany: number;
  active: boolean;
}
