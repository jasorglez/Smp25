import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { Iusers } from '../interface/iusers';
import { TrackingService } from './tracking.service';

import { alerts } from '../helpers/alerts';
import { map, concat, catchError, forkJoin, Observable, throwError } from 'rxjs';

import 'firebase/compat/database';

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  // Usemos signals
  profile = {
    idUser: signal<number>(null),
    emailUser: signal<string>(null),
    profilePicUser: signal<string>(null),
    nameUser: signal<string>(null),
    organizationUser: signal<string>(null),
    positionUser: signal<string>(null)
  };

  private trackingService = inject(TrackingService);
  
  profileSignal(id: number, email: string, picture: string, name: string, organization: string, position: string) {
    this.profile.idUser.set(id);
    this.profile.emailUser.set(email);
    this.profile.profilePicUser.set(picture);
    this.profile.nameUser.set(name);
    this.profile.organizationUser.set(organization);
    this.profile.positionUser.set(position);
  }

  //Constructor
  constructor(private http: HttpClient) { }

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }


  // Aqui comienzan los cambios hechos a SMP

  getDataUsers() {
    return this.http.get(`${environment.urlLinux}/User/users`, { headers: this.trackingService.getHeaders() });
  }

  addUser(data: any): Observable<any> {
    return this.http.post(`${environment.urlLinux}/User`, data, { headers: this.trackingService.getHeaders() });
  }

  updateUser(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlLinux}/User/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteUser(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlLinux}/User/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  getDepartments() {
    return this.http.get(`${environment.urlLinux}/Department`, { headers: this.trackingService.getHeaders() });
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
    return this.http.get<any>(`${environment.urlLinux}/User/email/${email}`, { headers }).pipe(
      map(datauser => {

        console.log('dataUser', datauser);

        // Asegúrate de que datauser contenga al menos un objeto
        const userArray = datauser.data;
        if (userArray) {
          const user = userArray as any;
          console.log('user:', user);

          // Asegúrate de que todas las propiedades existen en el objeto user
           const displayName = user.displayName || '';
           const picture = user.picture || '';
           const email = user.emailu || '';
           const applyproject = user.applyproject || '';
           const applybranch = user.applybranch || '';
           const applyplatform = user.applyplatform || ''; // Corregido de user.applybranch a user.applyplatform
           const id           = user.id   ;

          return { displayName, picture, applyproject, applybranch, applyplatform, email, id };
        } else {
          // Si no se encontró ningún usuario, devuelve un objeto vacío
          return { displayName: '', picture: '', applyproject: '', applybranch: '', applyplatform: '', email: '' };
        }
      })
    );
  }

}