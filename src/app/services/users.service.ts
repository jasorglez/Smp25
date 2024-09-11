import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { Iusers } from '../interface/iusers';

import { alerts } from '../helpers/alerts';
import { map, concat, catchError, forkJoin, Observable, throwError } from 'rxjs';

import 'firebase/compat/database';

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  // Usemos signals
  profile = {
    emailUser: signal<string>(null),
    profilePicUser: signal<string>(null),
    nameUser: signal<string>(null),
    organizationUser: signal<string>(null),
    positionUser: signal<string>(null)
  };

  profileSignal(email: string, picture: string, name: string, organization: string, position: string) {
    this.profile.emailUser.set(email);
    this.profile.profilePicUser.set(picture);
    this.profile.nameUser.set(name);
    this.profile.organizationUser.set(organization);
    this.profile.positionUser.set(position);
  }

  //Constructor
  constructor(private http: HttpClient) { }

  // Aqui comienzan los cambios hechos a SMP

  getDataUsers() {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
      return this.http.get(`${environment.urlLinux}/User/users`, {headers});
  }

  updateDataUsers(updates: any) {
    try {
      return this.http.put(`${environment.urlFirebase}users.json`, updates);
    }
    catch (error) {
      alerts.basicAlert("error", `Error putting data call Users${error}`, "error")
      return null;
    }
  }

  getDepartments() {
    try {
      return this.http.get(`${environment.urlFirebase}departaments.json`);
    }
    catch (error) {
      alerts.basicAlert("error", `Error get data call Users${error}`, "error")
      return null;
    }
  }

  deleteUsers(id: string) {
    return this.http.delete(`${environment.urlFirebase}users/${id}.json`);
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

  postData(data: Iusers, token: any) {
    try {
      return this.http.post(`${environment.urlFirebase}users.json?auth=${token}`, data);
    } catch (error) {
      alerts.basicAlert("error", `Error save Users${error}`, "error")
      return null;
    }

  }

  getCompaniesByPermission(email: string): Observable<any> {
    const url = `${environment.urlFirebase}permissions.json?orderBy="email"&equalTo="${email}"&print=pretty`;

    return this.http.get(url).pipe(
      map(data => {
        const permissions = Object.values(data);
        if (permissions.length === 0) {
          throw new Error('No se encontraron permisos para el correo electrónico proporcionado.');
        }
        const companies = permissions.map(permission => permission.id_company);
        return [...new Set(companies)];
      }),
      catchError(err => {
        console.log(err);
        return throwError(err);
      })
    );
  }



  checkIfDataExists(email: string): Observable<boolean> {
    const url = `${environment.urlFirebase}users.json?orderBy="emailu"&equalTo="${email}"`;

    return this.http.get<any>(url).pipe(
      map(response => {
        // Verificar si hay datos en la respuesta
        const dataExists = Object.keys(response).length > 0;
        return dataExists;
      }),
      catchError(error => {
        return throwError('Error en la solicitud');
      })
    );
  }


  patchData(id: string, data: object, token: any) {
    return this.http.patch(`${environment.urlFirebase}users/${id}.json?auth=${token}`, data);
  }


  getItem(id: string) {
    return this.http.get(`${environment.urlFirebase}users/${id}.json`);
  }

  getFilterDataperm(orderBy: string, equalTo: string) {

    const url = `${environment.urlFirebase}permissions.json?orderBy="${orderBy}"&equalTo="${equalTo}"`;

    return this.http.get(`${environment.urlFirebase}permissionsxcompanys.json?orderBy="${orderBy}"&equalTo="${equalTo}"`);
  }

  getCompaniesPermission(userEmail: string): Observable<any> {

    const permissionsUrl = `${environment.urlFirebase}permissionsxcompanys.json`;
    const companyUrl = `${environment.urlFirebase}companys.json`;

    const permissions$ = this.http.get(permissionsUrl);
    const company$ = this.http.get(companyUrl);

    return forkJoin([permissions$, company$]);

    return concat(permissions$, company$)

  }


  findEmail(email: string): Observable<any> {
    return this.http.get<any>(`${environment.urlFirebase}users.json?orderBy="emailu"&equalTo="${email}"`).pipe(
      map(datauser => {

        // console.log('dataUser', datauser) ;

        // Asegúrate de que datauser contenga al menos un objeto
        const userArray = Object.values(datauser);
        if (userArray.length > 0) {
          const user = userArray[0] as any;
          //console.log('user:', user);

          // Asegúrate de que todas las propiedades existen en el objeto user
          const displayName = user.displayName || '';
          const picture = user.picture || '';
          const email = user.emailu || '';
          const applyproject = user.applyproject || '';
          const applybranch = user.applybranch || '';
          const applyplatform = user.applyplatform || ''; // Corregido de user.applybranch a user.applyplatform

          return { displayName, picture, applyproject, applybranch, applyplatform, email };
        } else {
          // Si no se encontró ningún usuario, devuelve un objeto vacío
          return { displayName: '', picture: '', applyproject: '', applybranch: '', applyplatform: '', email: '' };
        }
      })
    );
  }

}
