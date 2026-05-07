import { Component, ViewEncapsulation, effect, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SharedModule } from 'app/shared/shared.module';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { AuthService } from 'app/services/auth.service';

const ROUTES_WITH_OWN_MENU = ['palacio-municipal'];

@Component({
  selector: 'app-procmodadmon',
  standalone: true,
  imports: [RouterModule, DomainsModule, SharedModule],
  templateUrl: './procmodadmon.component.html',
  styleUrl: './procmodadmon.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ProcmodadmonComponent {
   private signalsService = inject(SignalsService);
   private trackingService = inject(TrackingService);
   authService = inject(AuthService);
   router = inject(Router);

  idUser: number = null;

  get hideParentMenu(): boolean {
    return ROUTES_WITH_OWN_MENU.some(r => this.router.url.includes(r));
  }

  constructor() {
    // --- ACCIÓN INICIAL ---
    // Establecemos el valor inicial de la señal UNA SOLA VEZ al crear el componente.
    // Esto es una acción, no una reacción, por lo tanto, va fuera del effect.
    this.signalsService.setCatalogSelected('ADMINISTRATION');

    // --- REACCIÓN A CAMBIOS FUTUROS ---
    // El effect ahora solo se usa para su propósito: reaccionar a cambios y
    // actualizar propiedades locales, sin escribir en otras señales.
effect(() => {
      this.idUser = this.signalsService.getIdUSer()();
      this.signalsService.getDisplayName()()  ;
    });
  }


}
