import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';

import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';

@Injectable({
      providedIn: 'root'
    })
    export class BranchsService {

private http = inject(HttpClient)

branchs(): Observable<any> {
  try {
    const apiUrl = `${environment.urlFirebase}branchs.json`;
    return this.http.get(apiUrl);
  } catch(error) {
    console.error("Error Get Branchs", error);
    return EMPTY; // Import EMPTY from 'rxjs'
  }
}

}