import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Icompany } from '../interface/icompany';

import { catchError, map } from 'rxjs/operators';
import { EMPTY, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CompanysService {

  private _idEmpresa : number ;

  constructor( private http: HttpClient ) {
    this._idEmpresa = 0 ;
   }

   private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }

  private getHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }


      /*-------------------------------
 * aqui obtengo el email del login y lo fijo
 ------------------------------*/


/*----------------------------------------------------------------------------------
 * Obtener la consulta por email para ver que empresas le corresponden al LookCombo
 ------------------------------------------------------------------------------------*/

getEmpresasxEmail(orderBy:string, equalTo:string){
  const apiUrl =`${environment.urlFirebase}companyxusers.json?orderBy="${orderBy}"&equalTo="${equalTo}"`;
 try {
  return this.http.get(apiUrl);
 }catch(error) {
  console.error('ERROR in companyxusers', error);
  return null
 }
}

//Tomar la data de la colección Empresas en Firebase
getDataCompanys(clave: string): Observable<Icompany | null> {
  if (clave !== '') {
    return this.http.get<any>(`${environment.urlFirebase}companys.json?orderBy="$key"&equalTo="${clave}"`)
      .pipe(
        map(data => {
          const companyData = data[clave] as Icompany;
          if (companyData) {
            const { displayName, email, phone, picture, rfc, state, formatrep } = companyData;
            return { displayName, email, phone, picture, rfc, state, formatrep };
          } else {
            return null;
          }
        })
      );
  } else {
    return this.http.get<any>(`${environment.urlFirebase}companys.json`);
  }
}

//Tomar la data de la colección Empresas en Azure
getDataCompanysAzure() {
  const headers = this.getHeaders();
    return this.http.get(`${environment.urlLinux3}/Companys`, { headers });
}

getEmpresa(id: string): Observable<any> {
try {
return this.http.get(`${environment.urlFirebase}companys/${id}.json`);
}
catch(error) {
console.error();
return of(error);
}

}


async addpermiscompany(company: string, email: string, id_company: string, orden: number): Promise<void> {
const data = {
company,
email,
id_company,
orden
};

try {

await this.http.post(`${environment.urlFirebase}permissionsxcompanys.json`, data).toPromise();

} catch (error) {

console.error('Error al crear el permiso de la empresa:', error);

throw error; // Lanzar el error para manejarlo en la función llamadora si es necesario
}
}


getpermissionsxCompany(mail: string): Observable<any> {
  const apiUrl = `${environment.urlFirebase}permissionsxcompanys.json?orderBy="orden"&startAt=1`;

  return this.http.get<Record<string, any>>(apiUrl).pipe(
    map((data) => {
      const filteredData = Object.values(data).filter((item) => item.email === mail);
      return filteredData.sort((a, b) => a.orden - b.orden);
    }),
    catchError((error) => {
      console.error("Error al obtener permisos de la compañía", error);
      return of([]); // Retorna un observable vacío en caso de error
    })
  );
}


getpermissionsxBranch(id_company: string, mail: string): Observable<any> {
try {
const apiUrl= `${environment.urlFirebase}permissionsxbranchs.json?orderBy="id_company"&equalTo="${id_company}"`
return this.http.get(apiUrl)
.pipe(
map((permissions: any) => {
  return Object.values(permissions).filter((permission: any) => {
    return permission.id_company === id_company && permission.email === mail;
  });
})
);
} catch (error) {
console.error("Error al obtener permisos de las sucursales", error);
throw Error ;
return of (null);
}
}

getpermissionsxProject(branch:string, mail:string): Observable<any>{
try {
const apiUrl = `${environment.urlFirebase}permissionsxprojects.json?orderBy="id_branchs"&equalTo="${branch}"`
return this.http.get(apiUrl).pipe(
map((permissions : any) => {
return Object.values(permissions).filter((permission: any) => {
  return permission.mail === mail
}) ;
})
);
}catch(error) {
console.error("Error al Obtener permisos del Projecto", error)
throw Error ;
return of(null)
}
}

getpermissionsxCprocess(branch:string, mail:string): Observable<any>{
  try {
    const apiUrl = `${environment.urlAzure}api/permission?email=${mail}`
    return this.http.get(apiUrl)
  }catch(error){
    console.error("Error Managment files", error) ;
  return EMPTY ;
  }
 }

 
getPermissionsxPlatform(id: number): Observable<any> {
  const apiUrl = `${environment.urlAzure}api/permission/plat?id=${id}`;

  return this.http.get(apiUrl).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error("Error get Platforms", error);
      // Retornamos un Observable vacío en lugar de null
      return of(null);
    })
  );
}

getpermissionsxProject2(branch:string): Observable<any>{
try {
const apiUrl = `${environment.urlFirebase}permissionsxprojects.json?orderBy="id_branchs"&equalTo="${branch}"`
return this.http.get(apiUrl);
}catch(error) {
console.error("Error al Obtener permisos del Projecto", error)
throw Error ;
return of(null)
}

}


postData(data: Icompany, token:any){
try {
return this.http.post(`${environment.urlFirebase}companys.json?auth=${token}`, data);

}catch(error) {
//  alerts.basicAlert("error", `Error save Users${error}`, "error")
console.error("Error al grabar Compania", error)
return null ;
}

}
patchData(id:string, data:object, token:any){
try {
return this.http.patch(`${environment.urlFirebase}companys/${id}.json?auth=${token}`, data);

}catch(error) {
//  alerts.basicAlert("error", `Error save Users${error}`, "error")
console.error("Error al grabar Compania", error)
return null ;
}
}


delete(id:string, token: any){
  try {
  return this.http.delete(`${environment.urlFirebase}companys/${id}.json?auth=${token}`);
  }catch(error){
  console.error("Error al borrar", error) ;
  return null ;
  }
}


Companys(): Observable<any> {
  try {
    const apiUrl = `${environment.urlAzure}api/Companys/id`;
  //  alert(apiUrl)
    return this.http.get(apiUrl);
  } catch(error) {
    console.error("Error Get LogBook", error);
    return EMPTY; // Import EMPTY from 'rxjs'
  }
}

getProjectxCompany(prio: number, idcomp: number): Observable<any> {
  try {
    const apiUrl = `${environment.urlAzure}api/Project/company?priority=${prio}&comp=${idcomp}`;
   //  alert(apiUrl)
    return this.http.get(apiUrl);
  } catch(error) {
    console.error("Error Get Project", error);
    return EMPTY; // Import EMPTY from 'rxjs'
  }
}

}
