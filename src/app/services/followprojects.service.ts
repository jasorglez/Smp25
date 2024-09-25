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
  private http = inject(HttpClient);

  getContract(contract: number): Observable<Icontract> {
    return this.http.get<Icontract>(`${environment.urlLinux4}/Contract?idBussines=${contract}`, { headers: this.trackingService.getHeaders() });
  }

  getContractById(id: number): Observable<any> {
    return this.http.get<Icontract>(`${environment.urlLinux4}/Contract/${id}`, { headers: this.trackingService.getHeaders() });
  }

  addContract(data: any): Observable<any> {
    return this.http.post(`${environment.urlLinux4}/Contract`, data, { headers: this.trackingService.getHeaders() });
  }

  updateContract(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlLinux4}/Contract/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteContract(id: number): Observable<any> {
    return this.http.delete(`${environment.urlLinux4}/Contract/${id}`, { headers: this.trackingService.getHeaders() });
  }


}
