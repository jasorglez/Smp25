import { Employee } from './employee.model';

/**
 * Representa la estructura completa de los datos de nómina
 */
export interface NominaData {
  sucursal?: string;
  empresa: string;
  periodo: string;
  ejercicio: string;
  empleados: Employee[];
  archivo?: File;
  archivoNombre?: string
}
