import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class EmpleadosxProyectosService {
  private http = inject(HttpClient);
  private trackingService = inject(TrackingService);

  getByEmployee(idEmployee: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.urlAdministration}/EmployeeXProyect/employee/${idEmployee}`,
      { headers: this.trackingService.getHeaders() }
    );
  }

  add(data: { idEmployee: number; idProyect: number }): Observable<any> {
    return this.http.post(
      `${environment.urlAdministration}/EmployeeXProyect`,
      data,
      { headers: this.trackingService.getHeaders() }
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete(
      `${environment.urlAdministration}/EmployeeXProyect/${id}`,
      { headers: this.trackingService.getHeaders() }
    );
  }
}
