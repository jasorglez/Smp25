import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { TrackingService } from './tracking.service';
import { Observable } from 'rxjs';
import { Icontract } from '../interface/icontract';


@Injectable({
  providedIn: 'root'
})
export class FollowprojectsService {

  private trackingService = inject(TrackingService);
  private http = inject(HttpClient) ;

  getContract(contract: number) : Observable<Icontract>{
     const apiUrl = (`${environment.urlLinux4}/Contract?idBussines=${contract}`);
    // alert(apiUrl)
     const options = { headers: this.trackingService.getHeaders() };
  
  return this.http.get<Icontract>(apiUrl, options);
  }

  addContract(data: any): Observable<any> {
    return this.http.post(`${environment.urlLinux4}/Contract`, data, { headers: this.trackingService.getHeaders() });
  }


}
