export interface IDailyReport {
  id?:               number;
  idOt?:             number | null;
  idProject?:        number | null;
  idProvider?:       number | null;
  idSubcontractProgram?: number | null;
  providerName?:      string | null;
  date?:             string;
  startTime?:        string;
  endTime?:          string;
  type?:             string;
  description?:      string;
  totalPay?:         number;
  close?:            boolean;
  paid?:             boolean;
  personal?:         number;
  fotos?:            number;
  videos?:           number;
  material?:         number;
  equipos?:          number;
  conceptos?:        number;
  notas?:            number;

  // Campos nuevos cabecera reporte
  numReporte?:       string | null;
  condition?:        string | null;   // Condiciones meteorológicas
  ubication?:        string | null;   // Ubicación
  platicasSeguridad?: string | null;  // Tema plática de seguridad

  active?:           boolean;

  // Propiedades internas AG Grid (no se envían al servidor)
  detailType?:       string | null;
  detailData?:       any[];
  visible?:          boolean;
  __isNew?:          boolean;
  __modified?:       boolean;
}
