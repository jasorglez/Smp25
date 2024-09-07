import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsersxoilfieldsService {

  constructor(private http: HttpClient) { }

  addUserxOilfield(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlFirebase}permissionsxoilfield/${id}.json`, data);
  }

  updateUserxOilfield(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlFirebase}permissionsxoilfield/${id}.json`, data);
  }

  deleteUserxOilfield(id: string): Observable<any> {
    return this.http.delete(`${environment.urlFirebase}permissionsxoilfield/${id}.json`);
  }

  bulkUpdateUsersxOilfields(updates: any[]): Observable<any> {
    const updateObject = {};
    updates.forEach(update => {
      const { id, ...data } = update;
      updateObject[id] = data;
    });

    return this.http.patch(`${environment.urlFirebase}permissionsxoilfield.json`, updateObject);
  }

  getDataUsersxOilfields(email: string): Observable<any> {
      return this.http.get(`${environment.urlFirebase}permissionsxoilfield.json?orderBy="email"&equalTo="${email}"&print=pretty`).pipe(
        map(response => {
          if (!response) return [];
          return Object.entries(response).map(([key, value]) => ({
            id: key,
            ...value
          }));
        })
      );
  }

  getCompanys() {
      return this.http.get(`${environment.urlFirebase}companys.json`);
  }
}
