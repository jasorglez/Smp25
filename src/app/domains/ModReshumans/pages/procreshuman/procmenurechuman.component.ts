import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { MenuService } from 'app/services/menu.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procmenurechuman',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procmenurechuman.component.html',
  styleUrl: './procmenurechuman.component.scss',
})
export class ProcmenurehumanComponent implements OnInit {
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private menuService = inject(MenuService);

  tabMenus: { masterIdentifier: string; identifier: string; permissionName: string; route: string; icon: string; principalSubIdentifier: string; tabOrder: number }[] = [];

  ngOnInit() {
    this.signalsService.setCatalogSelected('RESOURCEHUMAN');
    this.loadTabMenus();
  }

  loadTabMenus() {
    this.menuService.getTabMenus('hr').subscribe({
      next: (tabs) => { this.tabMenus = tabs; },
      error: (err) => console.error('Error loading HR tab menus:', err)
    });
  }
}
