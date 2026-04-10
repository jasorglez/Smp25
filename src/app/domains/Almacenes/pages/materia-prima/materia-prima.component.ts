import { Component, inject, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TrackingService } from '../../../../services/tracking.service';
import { SharedModule } from 'app/shared/shared.module';
import { DomainsModule } from 'app/domains/domainsmodule';
import { RouterModule } from '@angular/router';
import { SignalsService } from 'app/services/signals.service';
import { MenuService } from 'app/services/menu.service';
import { AuthService } from 'app/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-materia-prima',
  standalone: true,
  imports: [TranslateModule, RouterModule, DomainsModule, SharedModule, CommonModule],
  templateUrl: './materia-prima.component.html',
  styleUrl: './materia-prima.component.scss'
})
export class MateriaPrimaComponent implements OnInit {

  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private menuService = inject(MenuService);
  authService = inject(AuthService);

  tabMenus: { detailedIdentifier: string; identifier: string; permissionName: string; route: string; icon: string; tabOrder: number }[] = [];

  ngOnInit(): void {
    this.menuService.getSubTabMenus('mat_prim').subscribe({
      next: (tabs) => { this.tabMenus = tabs; },
      error: (err) => console.error('Error cargando sub-tabs materia-prima', err)
    });
  }
}
