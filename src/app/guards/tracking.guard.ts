import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate } from "@angular/router";
import { TrackingService } from "app/services/tracking.service";

// tracking.guard.ts
@Injectable({ providedIn: 'root' })
export class TrackingGuard implements CanActivate {
  
      constructor(private trackingService: TrackingService) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const trackingData = route.data['tracking'];
    if (trackingData) {
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        trackingData.logMessage,
        trackingData.category,
        this.trackingService.getEmail()
      );
    }
    return true; // Permite la navegación
  }
}
