import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersxcontractsService {

  constructor(private http: HttpClient) { }

  getDataUsersxContracts(email: string): Observable<any> {
    return this.http.get(`${environment.urlFirebase}permissionsxcontract.json?orderBy="email"&equalTo="${email}"`)
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

  addUserxContract(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlFirebase}permissionsxcontract/${id}.json`, data);
  }

  updateUserxContract(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlFirebase}permissionsxcontract/${id}.json`, data);
  }

  deleteUserxContract(id: string): Observable<any> {
    return this.http.delete(`${environment.urlFirebase}permissionsxcontract/${id}.json`);
  }

  bulkUpdateUsersxContracts(updates: any[]): Observable<any> {
    const updateObject = {};
    updates.forEach(update => {
      const { id, ...data } = update;
      updateObject[id] = data;
    });

    return this.http.patch(`${environment.urlFirebase}permissionsxcontract.json`, updateObject);
  }

}
