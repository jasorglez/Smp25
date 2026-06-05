import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuService } from 'app/services/menu.service';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-procmenumolienda',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './procmenumolienda.component.html',
})
export class ProcmenumoliendaComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  authService = inject(AuthService);
  private menuService = inject(MenuService);

  tabMenus: { detailedIdentifier: string; identifier: string; permissionName: string; route: string; icon: string; tabOrder: number }[] = [];

  ngOnInit(): void {
    this.menuService.getSubTabMenus('molienda_princ').subscribe({
      next: (tabs) => { this.tabMenus = tabs; this.cdr.detectChanges(); },
      error: (err) => console.error('Error cargando sub-tabs molienda', err)
    });
  }
}
