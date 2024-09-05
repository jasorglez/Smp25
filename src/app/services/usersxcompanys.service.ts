import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, from } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class UsersxcompanysService {
  constructor(private http: HttpClient) { }

  getDataUsersxCompanys(email: string): Observable<any> {
    return this.http.get(`${environment.urlFirebase}permissionsxcompanys.json?orderBy="email"&equalTo="${email}"`)
      .pipe(
        map(response => {
          if (!response) return [];
          return Object.entries(response).map(([key, value]) => ({
            id: key,
            ...value
          }));
        })
      );
  }

  addUserxCompany(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlFirebase}permissionsxcompanys/${id}.json`, data);
  }

  updateUserxCompany(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlFirebase}permissionsxcompanys/${id}.json`, data);
  }

  deleteUserxCompany(id: string): Observable<any> {
    return this.http.delete(`${environment.urlFirebase}permissionsxcompanys/${id}.json`);
  }

  bulkUpdateUsersxCompanys(updates: any[]): Observable<any> {
    const updateObject = {};
    updates.forEach(update => {
      const { id, ...data } = update;
      updateObject[id] = data;
    });

    return this.http.patch(`${environment.urlFirebase}permissionsxcompanys.json`, updateObject);
  }
}