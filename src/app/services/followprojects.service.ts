import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { TrackingService } from './tracking.service';
import { Observable, switchMap } from 'rxjs';
import { Icontract } from '../interface/icontract';
import { CreatorPermissionService } from './creator-permission.service';


@Injectable({
  providedIn: 'root'
})
export class FollowprojectsService {

  private trackingService = inject(TrackingService);
  private http = inject(HttpClient);
  private creatorPermissionService = inject(CreatorPermissionService);

  getContract(contract: number): Observable<Icontract> {
    return this.http.get<Icontract>(`${environment.urlSmp}/Contract?idBranch=${contract}`, { headers: this.trackingService.getHeaders() });
  }

  getContractsByRoot(idRoot: number): Observable<Icontract[]> {
    return this.http.get<Icontract[]>(`${environment.urlSmp}/Contract/byRoot/${idRoot}`, { headers: this.trackingService.getHeaders() });
  }

  getContractById(id: number): Observable<any> {
    return this.http.get<Icontract>(`${environment.urlSmp}/Contract/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getContractDetails(id: number): Observable<any> {
    return this.http.get<any>(`${environment.urlSmp}/ContractDetails?contractId=${id}`, { headers: this.trackingService.getHeaders() });
  }

  addContractDetails(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/ContractDetails`, data, { headers: this.trackingService.getHeaders() });
  }

  updateContractDetails(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/ContractDetails/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteContractDetails(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/ContractDetails/${id}`, { headers: this.trackingService.getHeaders() });
  }


  //cambios de David
  addContract(data: any): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Contract`, data, { headers: this.trackingService.getHeaders() }).pipe(
      switchMap(created => this.creatorPermissionService.grantToCreator('contract', created))
    );
  }

  updateContract(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.urlSmp}/Contract/${id}`, data, { headers: this.trackingService.getHeaders() });
  }

  deleteContract(id: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Contract/${id}`, { headers: this.trackingService.getHeaders() });
  }

  getContractExecutingBranches(idContract: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.urlSmp}/Contract/${idContract}/executing-branches`, { headers: this.trackingService.getHeaders() });
  }

  addContractExecutingBranch(idContract: number, idBranch: number): Observable<any> {
    return this.http.post(`${environment.urlSmp}/Contract/${idContract}/executing-branches`, { idBranch }, { headers: this.trackingService.getHeaders() });
  }

  removeContractExecutingBranch(idContract: number, idBranch: number): Observable<any> {
    return this.http.delete(`${environment.urlSmp}/Contract/${idContract}/executing-branches/${idBranch}`, { headers: this.trackingService.getHeaders() });
  }
}
