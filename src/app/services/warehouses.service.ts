import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WarehousesService {

  constructor(private http : HttpClient) { }

  getWarehouses(company: string, project: string): Observable<any> {
    try {
      const apiUrl = `${environment.urlAzure}api/Warehouse/${company}/${project}`;
      return this.http.get(apiUrl);
    } catch(error) {
      console.error("Error Get Warehouses", error);
      return EMPTY; // Import EMPTY from 'rxjs'
    }
  }
  Delete(id: number, token: string | null): Observable<any> {
    try {
      const apiUrl = `${environment.urlAzure}api/Warehouse/${id}`;
      return this.http.delete(apiUrl);
    } catch(error) {
      console.error("Error Delete Warehouses", error);
      return EMPTY; // Import EMPTY from 'rxjs'
    }
  }

Post(data: any, token:any) {
  try {
   // console.log(data);
    const apiUrl = `${environment.urlAzure}api/Warehouse`;
    //console.log(apiUrl);
    return this.http.post(apiUrl, data)
  }catch(error){
    alert("Error Post Warehouses") ;
  return null ;
  }
}

Patch(id: number, data: any, token:any) {
  //console.log(data);
  try {
    const apiUrl = `${environment.urlAzure}api/Warehouse/${id}`;
    //console.log(apiUrl);
    return this.http.put(apiUrl, data)
  }catch(error){
    alert("Error PUT Warehouses") ;
  return null ;
  }
}

}
