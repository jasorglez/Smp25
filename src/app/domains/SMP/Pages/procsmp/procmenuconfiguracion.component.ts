import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';
import { MenuService } from 'app/services/menu.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-procmenuconfiguracion',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procmenuconfiguracion.component.html',
  styleUrl: './procmenuconfiguracion.component.scss'
})
export class ProcmenuconfiguracionComponent implements OnInit {
  private signalsService = inject(SignalsService);
  private menuService = inject(MenuService);
  authService = inject(AuthService);

  readonly guardUiTick = this.signalsService.guardRefreshTick;

  isRoot: boolean = false;
  tabMenus: { masterIdentifier: string; identifier: string; permissionName: string; route: string; icon: string; principalSubIdentifier: string; tabOrder: number }[] = [];

  ngOnInit() {
    this.isRoot = this.signalsService.getemailChoose() === environment.root;
    this.loadTabMenus();
  }

  loadTabMenus() {
    this.menuService.getTabMenus('setup').subscribe({
      next: (tabs) => { this.tabMenus = tabs; },
      error: (err) => console.error('Error loading setup tab menus:', err)
    });
  }
}
