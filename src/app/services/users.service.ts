import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { TrackingService } from './tracking.service';

import { alerts } from '../helpers/alerts';
import { map, Observable } from 'rxjs';

import 'firebase/compat/database';
import { SignalsService } from './signals.service';

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

  getUserById(id: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/User/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getUserByEmail(email: string): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/User/email/${email}`, { headers: this.trackingService.getHeaders() });
    }
  
  addUser(data: any): Observable<any> {
    return this.http.post(`${environment.urlSecurity}/User`, data, { headers: this.trackingService.getHeaders() });
  }

  updateUser(id: string, data: any): Observable<any> {
    console.log('DATA EN EL UPDATE', data)
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
    //  const headers = localStorage.getItem('token') ;
    return this.http.get<any>(`${environment.urlSecurity}/User/email/${email}`, { headers }).pipe(
      map(datauser => {

       // console.log('dataUser', datauser);

        // Asegúrate de que datauser contenga al menos un objeto
        const userArray = datauser.data;
        if (userArray) {
          const user = userArray as any;
          console.log('User Findemail:', user);

          // Asegúrate de que todas las propiedades existen en el objeto user
           const displayName = user.displayName || '';
           const picture = user.picture || '';
           const email = user.email || '';
           const applyproject = user.applyproject || '';
           const applybranch = user.applybranch || '';
           const applyplatform = user.applyplatform || ''; // Corregido de user.applybranch a user.applyplatform
           const id           = user.id   ;
           const signature = user.signature || '';
         //  this.signalsService.setidUser(datauser.id);
         this.signalsService.setDisplayName(displayName);

          return { displayName, picture, applyproject, applybranch, applyplatform, email, id, signature };
        } else {
          // Si no se encontró ningún usuario, devuelve un objeto vacío
          return { displayName: '', picture: '', applyproject: '', applybranch: '', applyplatform: '', email: '', signature: '' };
        }
      })
    );
  }

}