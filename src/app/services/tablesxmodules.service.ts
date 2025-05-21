import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class TablesxmodulesService {

  // lo construyo soriano

  constructor() { }

      private http = inject(HttpClient);
      private trackingService = inject(TrackingService);

    
      // Setup WareHouse
      getTablesxmodules(table: string, selection: string) {
        return this.http.get(`${environment.urlWarehouse}/TablesXModules`, {
          headers: this.trackingService.getHeaders(),
          params: {
            table: table,
            selectedSection: selection
          }
        });
      }
      
        
      addTablesxmodules(data: any): Observable<any> {
        return this.http.post(`${environment.urlWarehouse}/TablesXModules`, data, { headers: this.trackingService.getHeaders() });
      }
    
      updateTablesxmodules(id: string, data: any): Observable<any> {
        return this.http.put<any[]>(`${environment.urlWarehouse}/TablesXModules/${id}`, data, { headers: this.trackingService.getHeaders() });
      }
    
      getTablesxmodulesSection(table : string) {
        return this.http.get(`${environment.urlWarehouse}/TablesXModules/secions?table=${table}`, { headers: this.trackingService.getHeaders() });
      }


}
