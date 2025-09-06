import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from 'app/services/auth.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-procestimates',
  standalone: true,
  imports: [RouterModule, TranslateModule],
  templateUrl: './procestimates.component.html',
  styleUrl: './procestimates.component.scss'
})
export class ProcesstimatesComponent {
  
  authService = inject(AuthService);
  private trackingService = inject(TrackingService);

  constructor() {
    // Log de acceso al page de estimaciones
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Acceso a Módulo Estimaciones',
      'Modulo Proyectos - Estimaciones',
      this.trackingService.getEmail()
    );
  }
}