import { Component, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { SideBarComponent } from 'app/shared/side-bar/side-bar.component';
import { FooterComponent } from 'app/shared/footer/footer.component';
import { SignalsService } from '../../services/signals.service';

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SideBarComponent, FooterComponent],
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
})
export class MainPageComponent implements OnInit {
  private signalsService = inject(SignalsService);
  private router = inject(Router);

  private initialBranchId: number;
  isSidebarCollapsed: boolean = false;

  licenseStatus   = this.signalsService.getLicenseStatus();
  licenseDays     = this.signalsService.getLicenseDaysRemaining();

  constructor() {
    effect(() => {
      const newBranchId = this.signalsService.getBranchSelectedBySidebar()();
      const isAdvanced = this.signalsService.getIsAdvanced();
      if (this.initialBranchId !== undefined && this.initialBranchId !== newBranchId && isAdvanced) {
        this.router.navigateByUrl('/dashboard'); // Navega a la ruta base del 'main' layout
      }
    });
  }

  ngOnInit(): void {
    this.initialBranchId = this.signalsService.getBranchSelectedBySidebar()();

    // Cargar estado inicial del sidebar
    const savedState = localStorage.getItem('sidebarCollapsed');
    this.isSidebarCollapsed = savedState === 'true';

    // Escuchar cambios en localStorage (cuando otro tab o el sidebar cambia el estado)
    window.addEventListener('storage', this.handleStorageChange.bind(this));

    // Escuchar cambios locales (mismo tab)
    this.checkSidebarState();
    setInterval(() => this.checkSidebarState(), 100);
  }

  private handleStorageChange(event: StorageEvent) {
    if (event.key === 'sidebarCollapsed') {
      this.isSidebarCollapsed = event.newValue === 'true';
    }
  }

  private checkSidebarState() {
    const currentState = localStorage.getItem('sidebarCollapsed') === 'true';
    if (this.isSidebarCollapsed !== currentState) {
      this.isSidebarCollapsed = currentState;
    }
  }
}
