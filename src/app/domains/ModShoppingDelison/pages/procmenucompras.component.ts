import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { MenuService } from 'app/services/menu.service';
import { SignalsService } from 'app/services/signals.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-procmenucompras',
  standalone: true,
  imports: [RouterModule, DomainsModule, CommonModule],
  templateUrl: './procmenucompras.component.html',
})
export class ProcmenucomprasComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private menuService = inject(MenuService);

  get hasNupnpn() { return this.signalsService.getHasNupnpnCompraRapida()(); }

  tabMenus: { masterIdentifier: string; identifier: string; permissionName: string; route: string; icon: string; principalSubIdentifier: string; tabOrder: number; skipPermission?: boolean }[] = [];

  ngOnInit() {
    this.signalsService.setCatalogSelected('SHOPPINGDELISON');
    this.loadTabMenus();
  }

  loadTabMenus() {
    this.menuService.getTabMenus('shoppingDelison').subscribe({
      next: (cached) => {
        // getTabMenus cachea el array con shareReplay(1): es la MISMA referencia en cada navegación.
        // Trabajamos sobre una COPIA para no mutar el caché (si no, el splice acumula "Gastos").
        const tabs = [...cached];

        const materiaPrimaTab = tabs.find(t => t.identifier === 'materia-prima');
        if (materiaPrimaTab) {
          materiaPrimaTab.permissionName = 'Materiales Maestros';
        }

        // Guarda idempotente: insertar "Gastos" solo si no existe ya.
        if (!tabs.some(t => t.identifier === 'gastos')) {
          const gastosTab = {
            masterIdentifier: 'shoppingDelison',
            identifier: 'gastos',
            permissionName: 'Gastos',
            route: 'gastos',
            icon: 'bi bi-receipt',
            principalSubIdentifier: '',
            tabOrder: 4.5,
            skipPermission: true,
          };
          const ocIdx = tabs.findIndex(t => t.identifier === 'purchas_eorder');
          tabs.splice(ocIdx + 1, 0, gastosTab);
        }

        this.tabMenus = tabs;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading tab menus:', err)
    });
  }
}
