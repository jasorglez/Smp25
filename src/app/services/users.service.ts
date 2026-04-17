import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { TrackingService } from './tracking.service';

import { alerts } from '../helpers/alerts';
import { map, Observable } from 'rxjs';

import 'firebase/compat/database';
import { SignalsService } from './signals.service';
import { SafeUserData, ApiResponse, sanitizeUserData } from 'app/interface/safe-user.interface';

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  private trackingService = inject(TrackingService);
  private http = inject(HttpClient);
  private signalsService = inject(SignalsService);

  // Aqui comienzan los cambios hechos a SMP

  getAllUsers(): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/User/users`, { headers: this.trackingService.getHeaders() });
  }

  getDataUsers(idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/User/userdep?id=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  get2fieldsUsers(idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/User/2fields?idCompany=${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  updateActulizarSecurity(idUser: number, Operacion: string): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/User/security/${idUser}/${Operacion}`, {}, { headers: this.trackingService.getHeaders() });
  }

  getUserById(id: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/User/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getUserByEmail(email: string): Observable<SafeUserData> {
    return this.http.get<ApiResponse<any>>(`${environment.urlSecurity}/User/email/${email}`,
      { headers: this.trackingService.getHeaders() }
    ).pipe(
      map(response => sanitizeUserData(response.data))
    );
  }

  getUserByUserSmall(userSmall: string): Observable<SafeUserData> {
    return this.http.get<ApiResponse<any>>(`${environment.urlSecurity}/User/usersmall?user=${encodeURIComponent(userSmall)}`,
      { headers: this.trackingService.getHeaders() }
    ).pipe(
      map(response => sanitizeUserData(response.data))
    );
  }

  addUser(data: any): Observable<any> {
    return this.http.post(`${environment.urlSecurity}/User`, data, { headers: this.trackingService.getHeaders() });
  }

  updateUser(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/User/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteUser(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/User/${id}`, data, { headers: this.trackingService.getHeaders() });

  }

  // Aqui terminan los cambios a SMP

  getdataUserAut() {
    try {
      return this.http.get(`${environment.urlAzure}api/Users/Aut`);
    } catch (error) {
      alerts.basicAlert('error', "Error query Users in Users service", "error");
      return null;
    }
  }

  getdataUserNoAut() {
    try {
      return this.http.get(`${environment.urlAzure}api/Users/NoAut`);
    } catch (error) {
      alerts.basicAlert('error', "Error query Users in Users service", "error");
      return null;
    }
  }


  findEmail(email: string): Observable<any> {
    const headers = this.trackingService.getHeaders();
    return this.http.get<ApiResponse<any>>(`${environment.urlSecurity}/User/email/${email}`, { headers }).pipe(
      map(response => {
        if (!response.data) {
          // Si no se encontró ningún usuario, devuelve un objeto vacío
          return {
            displayName: '',
            picture: '',
            applyproject: '',
            applybranch: '',
            applyplatform: '',
            email: '',
            signature: '',
            userRoot: 0
          };
        }

// Limpiar datos sensibles
        const safeUser = sanitizeUserData(response.data);

        // Actualizar signals con datos seguros
        this.signalsService.setDisplayName(safeUser.displayName);
        this.signalsService.setUserRoot(safeUser.isRoot);
        this.signalsService.setidUser(safeUser.id);
        this.signalsService.setInvited(safeUser.invited);

        // Devolver solo los campos necesarios (compatibilidad con código existente)
        return {
          displayName: safeUser.displayName,
          picture: safeUser.picture,
          applyproject: safeUser.applyProject,
          applybranch: safeUser.applyBranch,
          applyplatform: safeUser.applyPlatform,
          email: safeUser.email,
          id: safeUser.id,
          signature: safeUser.signature,
          userRoot: safeUser.isRoot
        };
      })
    );
  }

}
