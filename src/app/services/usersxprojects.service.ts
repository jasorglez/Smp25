import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersxprojectsService {

  constructor(private http: HttpClient) { }

  addUserxProject(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlFirebase}permissionsxprojects/${id}.json`, data);
  }

  updateUserxProject(id: string, data: any): Observable<any> {
    return this.http.put(`${environment.urlFirebase}permissionsxprojects/${id}.json`, data);
  }

  deleteUserxProject(id: string): Observable<any> {
    return this.http.delete(`${environment.urlFirebase}permissionsxprojects/${id}.json`);
  }

  bulkUpdateUsersxProjects(updates: any[]): Observable<any> {
    const updateObject = {};
    updates.forEach(update => {
      const { id, ...data } = update;
      updateObject[id] = data;
    });

    return this.http.patch(`${environment.urlFirebase}permissionsxprojects.json`, updateObject);
  }

  getDataUsersxProjects(mail: string): Observable<any> {
      return this.http.get(`${environment.urlFirebase}permissionsxprojects.json?orderBy="mail"&equalTo="${mail}"&print=pretty`).pipe(
        map(response => {
          if (!response) return [];
          return Object.entries(response).map(([key, value]) => ({
            id: key,
            ...value
          }));
        })
      );
  }
}
