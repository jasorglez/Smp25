import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuService } from 'app/services/menu.service';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-preparacion1',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="col-md-12">
      <div class="card mt-3">
        <div class="card-header p-2">
          <ul class="nav nav-pills nav-level-2">
            <ng-container *ngFor="let tab of tabMenus">
              <li class="nav-item"
                  *ngIf="authService.hasSubDetailedPermission('production', 'preparacion1', tab.identifier)">
                <a class="nav-link" [routerLink]="tab.route" routerLinkActive="active">
                  <i [class]="tab.icon"></i> {{ tab.permissionName }}
                </a>
              </li>
            </ng-container>
          </ul>
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
})
export class Preparacion1Component implements OnInit {
  authService = inject(AuthService);
  private menuService = inject(MenuService);

  tabMenus: { detailedIdentifier: string; identifier: string; permissionName: string; route: string; icon: string; tabOrder: number }[] = [];

  ngOnInit(): void {
    this.menuService.getSubTabMenus('preparacion1').subscribe({
      next: (tabs) => { this.tabMenus = tabs; },
      error: (err) => console.error('Error cargando sub-tabs preparacion1', err)
    });
  }
}
