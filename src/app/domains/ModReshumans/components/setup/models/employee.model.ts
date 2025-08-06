/**
 * Representa la información de un empleado en la nómina
 */
export interface Employee {
    nombre: string;
    idEmpleado: number;
    diasTrabajados: number;
    salarioDiarioIntegrado: number;
    salarioDiario: number;
    sueldos: number;
    totalPercepciones: number;
    otrosIngresos: number;
    percepcionesGravadas: number;
    impuestoArt96: number;
    subsidioArt114: number;
    totalSubsidioPEmpleoArt115: number;
    subsidioPEmpleoAcreditado: number;
    ISPT: number;
    subsidioPEmpleo: number;
    IMSSEnfermedad: number;
    IMSSCesantiaVejez: number;
    IMSS: number;
    retencionesINFONAVIT: number;
    pensionAlimenticia: number;
    neto: number;
    firma: string
  }
