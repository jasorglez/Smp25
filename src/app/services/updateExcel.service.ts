import { effect, inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { SignalsService } from './signals.service';
import { environment } from '../../environments/environment';
import { EmployeesService } from './employees.service';
import { TrackingService } from './tracking.service';
import { alerts } from '../helpers/alerts';
import { map, Observable } from 'rxjs';
import { OtService } from './ot.service';


interface FormData {
  numeroOS: number;
  inmueble: number;
  nombreDelServicio: string;
  equipoEjecutor: string;
  colonia: string;
  calle: string;
  numero: number;
  trabajoRealizado: string;
  resultadoDelTrabajo: string;
  cantidad: number;
  fechaAsignacion: string;
  fechaEjecucion: string;
  dias: number;
  area: string;
  validado: string;
  observaciones: string;
  incidencia: string;
}

interface PersonalItem {
  cuadrilla: string;
  date: string;
  description: string;
  end: string | null;
  id: number;
  idOt: number;
  idProject: number;
  idReporte: number;
  idResource: number;
  imageAzure: string;
  imageUrl: string | null;
  metadata: any; // puedes tipar mejor si sabes la estructura
  orden: number;
  position: string;
  quantity: number;
  start: string | null;
  supervisor: string | null;
  timexnote: string;
  typeNote: string;
}

@Injectable({
  providedIn: 'root'
})
export class UpdateExcelService {
  private trackingService = inject(TrackingService);
  private http = inject(HttpClient);
  private signalsService = inject(SignalsService); 
  private otService =inject(OtService);
  private employeesService =inject(EmployeesService);


  dataOt: any = null
  data: FormData = {} as FormData
  employees: any[] =[]

  constructor (){
    effect(()=>{
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      
        this.loadEmployees();

    });
  }
  fechasConsult(fechaInicio: string, fechaFin: string) {
  const dateRange = {
    dateStart: fechaInicio,  // formato: "2025-08-07" o "2025-08-07T00:00:00"
    dateEnd: fechaFin        // formato: "2025-08-09" o "2025-08-09T23:59:59"
  };

  return this.http.post(
    `${environment.urlSmp}/UpdateExcel/date`, dateRange, 
    { headers: this.trackingService.getHeaders() }
  );
}


  loadEmployees() {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    const idBranch = -idRoot; // Convertir a negativo como se solicita
    console.log(idRoot)
    this.employeesService.getEmployees(idBranch).subscribe({
      next: (response: any) => {
        this.employees =response
        console.log(this.employees)
      },
      error: (error) => {
        console.error('Error al cargar empleados:', error);
        this.employees = [];
      }
    });
  }

  private formatDate(dateInput: any): string {
    if (!dateInput) return '';
    
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return dateInput.toString();
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  }
  dataPersonal(personal: PersonalItem[]): string {
    this.loadEmployees();
    const equipoData: Array<{cuadrilla: string, nombres: string[]}> = [];
    
    personal.forEach(p => {
      const cuadrillaNum = p.cuadrilla.split('Cuadrilla')[1]?.trim() || '';
      const employee = this.employees.find(em => em.id === p.idResource);
      const name = employee ? employee.name : 'Desconocido';
      
      let equipoExistente = equipoData.find(e => e.cuadrilla === cuadrillaNum);
      
      if (!equipoExistente) {
        equipoExistente = { cuadrilla: cuadrillaNum, nombres: [] };
        equipoData.push(equipoExistente);
      }
      
      if (!equipoExistente.nombres.includes(name)) {
        equipoExistente.nombres.push(name);
      }
    });
    
    // Formatear como "2(DANIEL Y MARCOS Y JUAN)"
    return equipoData.map(equipo => 
      `${equipo.cuadrilla}(${equipo.nombres.join(' Y ')})`
    ).join(', ');
  }


  UpdateOT(id: number){
     this.otService.getOtDetails(id).subscribe({
      next: (data: any) => {
        this.dataOt = data[0];
        
        // Generar equipo ejecutor dinámicamente
        const equipoEjecutor = this.dataOt.personal && this.dataOt.personal.length > 0 
          ? this.dataPersonal(this.dataOt.personal)
          : "EQUIPO NO ASIGNADO";
        
        this.data = {
                  "numeroOS": this.dataOt.otNumber || 0,
                  "inmueble": this.dataOt.cdc || 0,
                  "nombreDelServicio": this.dataOt.description || "",
                  "equipoEjecutor": equipoEjecutor,
                  "colonia": this.dataOt.neighborhood || "",
                  "calle": this.dataOt.address || "",
                  "numero": this.dataOt.oldAddressNumber || 0,
                  "trabajoRealizado": "CORTE EN TIERRA Y MAS",
                  "resultadoDelTrabajo": "EJECUTADO",
                  "cantidad": 1,
                  "fechaAsignacion": this.formatDate(this.dataOt.registerDate) || "24/05/2025",
                  "fechaEjecucion": "26/05/2025",
                  "dias": this.dataOt.dias || 0,
                  "area": this.dataOt.area || "",
                  "validado": "PAGO",
                  "observaciones": this.dataOt.results || "",
                  "incidencia": "SI"
                }
            
        this.UpdateExcel({ data: this.data }).subscribe({
        next: (res) => {
          console.log('Respuesta del backend:', res);
        },
        error: (err) => {
          console.error('Error al actualizar Excel:', err);
          if (err.error && err.error.errors) {
            console.error('Errores de validación:', err.error.errors);
          }
        }
      });
      }})
  }

  UpdateExcel(data: any): Observable<any> {
    console.log(data)
  return this.http.post(
    `${environment.urlSmp}/UpdateExcel/procesar`,
    data,
    { headers: this.trackingService.getHeaders() }
  );
}

  processAndDownloadOt(dateStart: string, dateEnd: string): Observable<Blob> {
    const dateRange = {
      dateStart: dateStart,
      dateEnd: dateEnd
    };

    return this.http.post(
      `${environment.urlSmp}/UpdateExcel/process-and-download-ot`,
      dateRange,
      { 
        headers: this.trackingService.getHeaders(),
        responseType: 'blob'
      }
    );
  }
  processAndDownloadCuadInter(dateStart: string, dateEnd: string): Observable<Blob> {
    const dateRange = {
      dateStart: dateStart,
      dateEnd: dateEnd
    };

    return this.http.post(
      `${environment.urlSmp}/UpdateExcel/process-and-download-cuadinter`,
      dateRange,
      { 
        headers: this.trackingService.getHeaders(),
        responseType: 'blob'
      }
    );
  }
}