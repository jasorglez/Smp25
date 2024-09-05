import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersxcompanysService {

  constructor(private http: HttpClient) { }

  deleteUserxCompanys(id: string) {
    return this.http.delete(`${environment.urlFirebase}permissionsxcompanys/${id}.json`);
  }

  getKeyByEmail(email: string): Observable<string | null> {
    return this.http.get<any>(`${environment.urlFirebase}permissionsxcompanys.json?orderBy="email"&equalTo="${email}"`)
      .pipe(
        map(response => {
          const keys = Object.keys(response);
          return keys.length > 0 ? keys[0] : null;
        })
      );
  }

  updateDataUserxCompanys(updates: any): Observable<any> {
    const email = updates[Object.keys(updates)[0]].email;
    
    return this.getKeyByEmail(email).pipe(
      switchMap(key => {
        if (key) {
          return this.http.patch(`${environment.urlFirebase}permissionsxcompanys/${key}.json`, updates[Object.keys(updates)[0]]);
        } else {
          return of({ error: 'No se encontró el registro para actualizar' });
        }
      })
    );
  }

  getDataUsersxCompanys(email: string): Observable<any> {
    try {
      return this.http.get(`${environment.urlFirebase}permissionsxcompanys.json?orderBy="email"&equalTo="${email}"&print=pretty`);
    }
    catch (error) {
      return of(error);
    }
  }
}
