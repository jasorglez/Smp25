import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'app/shared/shared.module';
import { DomainsModule } from 'app/domains/domainsmodule';
import { RouterModule } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';
import { MenuService } from 'app/services/menu.service';

@Component({
  selector: 'app-procmenualmacen',
  standalone: true,
  imports: [TranslateModule, RouterModule, DomainsModule, SharedModule],
  templateUrl: './procmenualmacen.component.html',
  styleUrl: './procmenualmacen.component.scss'
})
export class ProcmenualmacenComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private signalsService = inject(SignalsService);
  private menuService = inject(MenuService);
  authService = inject(AuthService);

  tabMenus: { masterIdentifier: string; identifier: string; permissionName: string; route: string; icon: string; principalSubIdentifier: string; tabOrder: number }[] = [];

  constructor() {
    this.signalsService.setCatalogSelected('WAREHOUSE');
  }

  ngOnInit() {
    this.loadTabMenus();
  }

  loadTabMenus() {
    this.menuService.getTabMenus('warehouses').subscribe({
      next: (tabs) => { this.tabMenus = tabs; this.cdr.detectChanges(); },
      error: (err) => console.error('Error loading almacenes tab menus:', err)
    });
  }
}
