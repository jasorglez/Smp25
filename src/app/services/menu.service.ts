import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { TrackingService } from './tracking.service';
import { SignalsService } from './signals.service';

@Injectable({
  providedIn: 'root'
})
export class MenuService {

  constructor() { }

   private trackingService = inject(TrackingService);
   private http = inject(HttpClient);

  private _sidebarMenusCache = new Map<number, Observable<any[]>>();
  private _tabMenusCache     = new Map<string, Observable<any[]>>();
  private _subTabMenusCache  = new Map<string, Observable<any[]>>();

  
  getMenu(idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/MenuXCompany/${idCompany}`, { headers: this.trackingService.getHeaders() });
  }

  getDetails(idCompany: number): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/DetailedPermissions`, { headers: this.trackingService.getHeaders() });
  } 

  getMasterMenu(): Observable<any> {
    return this.http.get(`${environment.urlSecurity}/MenuXCompany`, { headers: this.trackingService.getHeaders() });
  }

  getSidebarMenus(idCompany: number): Observable<{ identifier: string; permissionName: string; route: string; icon: string }[]> {
    if (!this._sidebarMenusCache.has(idCompany)) {
      this._sidebarMenusCache.set(
        idCompany,
        this.http.get<any[]>(`${environment.urlSecurity}/MenuXCompany/${idCompany}/sidebar`, { headers: this.trackingService.getHeaders() }).pipe(shareReplay(1))
      );
    }
    return this._sidebarMenusCache.get(idCompany)!;
  }

  clearSidebarCache(idCompany?: number): void {
    if (idCompany != null) {
      this._sidebarMenusCache.delete(idCompany);
    } else {
      this._sidebarMenusCache.clear();
      this._tabMenusCache.clear();
      this._subTabMenusCache.clear();
    }
  }
  getTabMenus(masterIdentifier: string): Observable<{ masterIdentifier: string; identifier: string; permissionName: string; route: string; icon: string; principalSubIdentifier: string; tabOrder: number }[]> {
    if (!this._tabMenusCache.has(masterIdentifier)) {
      this._tabMenusCache.set(
        masterIdentifier,
        this.http.get<any[]>(`${environment.urlSecurity}/DetailedPermissions/tabs/${masterIdentifier}`, { headers: this.trackingService.getHeaders() }).pipe(shareReplay(1))
      );
    }
    return this._tabMenusCache.get(masterIdentifier)!;
  }

  getSubTabMenus(detailedIdentifier: string): Observable<{ detailedIdentifier: string; identifier: string; permissionName: string; route: string; icon: string; tabOrder: number }[]> {
    if (!this._subTabMenusCache.has(detailedIdentifier)) {
      this._subTabMenusCache.set(
        detailedIdentifier,
        this.http.get<any[]>(`${environment.urlSecurity}/SubDetailedPermissions/tabs/${detailedIdentifier}`, { headers: this.trackingService.getHeaders() }).pipe(shareReplay(1))
      );
    }
    return this._subTabMenusCache.get(detailedIdentifier)!;
  }

  updateMenu(idCompany: number, permissions: any[]): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/MenuXCompany/${idCompany}`, permissions, { headers: this.trackingService.getHeaders() });
  }

  addPermitions(data: any): Observable<any> {
    return this.http.post(`${environment.urlSecurity}/CrudPremissionsDelison`, data, { headers: this.trackingService.getHeaders() });
  }
  updatePermitionsDetail(idUser: number, idBranch: number, idRole:number, idPosicion:number, idDetailedPermission: number,data: any): Observable<any> {
    return this.http.put(`${environment.urlSecurity}/CrudPremissionsDelison?idUser=${idUser}&idBranch=${idBranch}&idRole=${idRole}&idPosicion=${idPosicion}&idDetailedPermission=${idDetailedPermission}`,data, { headers: this.trackingService.getHeaders() });
  }
}
