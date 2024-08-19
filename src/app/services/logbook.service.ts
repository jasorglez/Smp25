import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LogbookService {

 private http = inject(HttpClient)

  getLB(dater: string, id: Number): Observable<any> {
    try {
      const apiUrl = `${environment.urlAzure}api/Logbook?lb=${dater}&id=${id}`;
     // alert(apiUrl)
      return this.http.get(apiUrl);
    } catch(error) {
      console.error("Error Get LogBook", error);
      return EMPTY; // Import EMPTY from 'rxjs'
    }
  }

  //llamo al servicio...

  fetchImages(dater: Date, id: Number): Observable<any>{
    try {
      const apiUrl = `${environment.urlAzure}api/Logbook/showphotos?lb=${dater}&id=&${id}`;
      return this.http.get(apiUrl);
    } catch(error) {
        console.error('Error fetching images:', error);
        return EMPTY ;
   }
 }


}
