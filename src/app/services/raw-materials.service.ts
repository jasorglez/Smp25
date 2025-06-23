import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrackingService } from './tracking.service';

@Injectable({
  providedIn: 'root'
})
export class RawMaterialsService {

  private http            = inject(HttpClient);
  private trackingService = inject(TrackingService);

  
}
