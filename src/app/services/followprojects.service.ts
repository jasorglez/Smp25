import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Icontract } from '../interface/icontract';


@Injectable({
  providedIn: 'root'
})
export class FollowprojectsService {

  constructor() { }
  private http = inject(HttpClient) ;

  getContract(company: number) : Observable<Icontract>{
     const apiUrl = (`${environment.urlAzure}api/Contract?idCompany=${company}`);
     return this.http.get<any>(apiUrl);
  }


}
