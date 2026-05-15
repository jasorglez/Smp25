import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { MenuService } from 'app/services/menu.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procmenucompras',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procmenucompras.component.html',
})
export class ProcmenucomprasComponent implements OnInit {
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private menuService = inject(MenuService);

  tabMenus: { masterIdentifier: string; identifier: string; permissionName: string; route: string; icon: string; principalSubIdentifier: string; tabOrder: number }[] = [];

  ngOnInit() {
    this.signalsService.setCatalogSelected('SHOPPINGDELISON');
    this.loadTabMenus();
  }

  loadTabMenus() {
    this.menuService.getTabMenus('shoppingDelison').subscribe({
      next: (tabs) => {
        const materiaPrimaTab = tabs.find(t => t.identifier === 'materia-prima');
        if (materiaPrimaTab) {
          materiaPrimaTab.permissionName = 'Materiales Maestros';
        }
        this.tabMenus = tabs;
      },
      error: (err) => console.error('Error loading tab menus:', err)
    });
  }
}
