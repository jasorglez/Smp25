import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { catchError, Observable, throwError } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class DailyReportService {

  constructor() { }

  private trackingService = inject(TrackingService);
  private http = inject(HttpClient);

 

  // Obtener reportes diarios por OT
  getDailyReportsByOt(idOt: number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/DailyReport/xot/${idOt}`, { headers: this.trackingService.getHeaders() });
  }

  getReportxCost(idReport: number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/DailyReport/cost?idReport=${idReport}`, { headers: this.trackingService.getHeaders() });
  }

  getTotalxCost(idRoot: number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/DailyReport/ot-project/${idReport}`, { headers: this.trackingService.getHeaders() });
  }
  
   // Actualizar solo el costo del reporte
  updateCostReport(idReport: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/DailyReport/${idReport}/totalconcepts`, data, { headers: this.trackingService.getHeaders() });
  }
  
  // Obtener detalles de un reporte diario específico
  getDailyReportDetails(idReport: number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/DailyReport/${idReport}`, { headers: this.trackingService.getHeaders() });
  }

  // Crear un nuevo reporte diario
  addDailyReport(data: any): Observable<any> {
   const apiUrl = `${environment.urlSmp}/DailyReport/`;
  // alert(apiUrl)
   console.log('Adding new daily report:', data);

    return this.http.post(`${environment.urlSmp}/DailyReport/`, data, { headers: this.trackingService.getHeaders() });
  }

  // Actualizar un reporte diario existente
  updateDailyReport(idReport: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/DailyReport/${idReport}`, data, { headers: this.trackingService.getHeaders() });
  }

  // Eliminar un reporte diario
  deleteDailyReport(idReport: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/DailyReport/${idReport}`, { headers: this.trackingService.getHeaders() });
  }

  // Métodos adicionales para funcionalidades específicas

  // Obtener reportes por fecha
  getDailyReportsByDate(date: string): Observable<any> {
    return this.http.get(`${environment.urlSmp}/DailyReport/date/${date}`, { headers: this.trackingService.getHeaders() });
  }

  // Obtener reportes por rango de fechas
  getDailyReportsByDateRange(startDate: string, endDate: string): Observable<any> {
    return this.http.get(`${environment.urlSmp}/DailyReport/daterange?start=${startDate}&end=${endDate}`, { headers: this.trackingService.getHeaders() });
  }

  // Obtener reportes por supervisor
  getDailyReportsBySupervisor(supervisor: string): Observable<any> {
    return this.http.get(`${environment.urlSmp}/DailyReport/supervisor/${encodeURIComponent(supervisor)}`, { headers: this.trackingService.getHeaders() });
  }

  // Obtener reportes por tipo de nota
  getDailyReportsByType(tipoNota: string): Observable<any> {
    return this.http.get(`${environment.urlSmp}/DailyReport/type/${encodeURIComponent(tipoNota)}`, { headers: this.trackingService.getHeaders() });
  }

  // Generar reporte PDF
  generateReportPdf(idReport: number): Observable<any> {
    return this.http.get(`${environment.urlSmp}/DailyReport/${idReport}/pdf`, { 
      headers: this.trackingService.getHeaders(),
      responseType: 'blob'
    });
  }

  // Suma de Conceptos X PDF
SumaReporte(
    resource: number,
    fecha1: string, // Formato: 'YYYY-MM-DD'
    fecha2: string
  ): Observable<{ Total: number }> {
    const url = `${environment.urlSmp}/DailyReport/resource-total?idResource=${resource}&startDate=${fecha1}&endDate=${fecha2}`;
     console.log(`SumaReporte URL: ${url}`);
  
    return this.http.get<{ Total: number }>(url, {
      headers: this.trackingService.getHeaders()
    }).pipe(
      catchError(error => {
        console.error('Error en SumaReporte:', error);
        return throwError(() => new Error('Error al obtener total del recurso'));
      })
    );
  }



  // Exportar múltiples reportes a PDF
  exportReportsToPdf(reportIds: number[]): Observable<any> {
    return this.http.post(`${environment.urlSmp}/DailyReport/export/pdf`, 
      { reportIds }, 
      { 
        headers: this.trackingService.getHeaders(),
        responseType: 'blob'
      }
    );
  }
}