import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';

@Injectable({
      providedIn: 'root'
    })
    export class OilfieldService {

private http = inject(HttpClient)

Oilfield(): Observable<any> {
  try {
    const apiUrl = `${environment.urlAzure}api/Oilfield`;
  //  alert(apiUrl)
    return this.http.get(apiUrl);
  } catch(error) {
    console.error("Error Get Oilfield", error);
    return EMPTY; // Import EMPTY from 'rxjs'
  }
}

getOilfields(): Observable<any> {
  try {
    const apiUrl = `${environment.urlFirebase}branchs.json?print=pretty`;      
     // alert(apiUrl)
    return this.http.get(apiUrl);
  } catch(error) {
    console.error("Error Get Project", error);
    return EMPTY; // Import EMPTY from 'rxjs'
  }
}

}