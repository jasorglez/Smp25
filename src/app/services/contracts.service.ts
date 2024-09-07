import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { EMPTY, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ContractsService {

  constructor() { }

  private http = inject(HttpClient)

  getContracts(): Observable<any> {
    try {
      const apiUrl = `${environment.urlAzure}api/Contract/2cont?idBussines=-Ns9jVoGHYgWpdel9hyF`;      
      return this.http.get(apiUrl);
    } catch(error) {
      console.error("Error Get Project", error);
      return EMPTY; // Import EMPTY from 'rxjs'
    }
  }
}
