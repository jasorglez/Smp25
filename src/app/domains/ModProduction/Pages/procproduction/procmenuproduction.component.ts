import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { MenuService } from 'app/services/menu.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procmenuproduction',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procmenuproduction.component.html',
  styleUrl: './procmenuproduction.component.scss',
})
export class ProcmenuprodcutionComponent implements OnInit {
  authService = inject(AuthService);
  private signalsService = inject(SignalsService);
  private menuService = inject(MenuService);
  private cdr = inject(ChangeDetectorRef);

  tabMenus: { masterIdentifier: string; identifier: string; permissionName: string; route: string; icon: string; principalSubIdentifier: string; tabOrder: number }[] = [];

  ngOnInit() {
    this.signalsService.setCatalogSelected('PRODUCTION');
    this.loadTabMenus();
  }

  loadTabMenus() {
    this.menuService.getTabMenus('production').subscribe({
      next: (tabs) => { this.tabMenus = tabs; this.cdr.detectChanges(); },
      error: (err) => console.error('Error loading Production tab menus:', err)
    });
  }
}
