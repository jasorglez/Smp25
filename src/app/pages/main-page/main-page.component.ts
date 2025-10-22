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

  constructor() {
    effect(() => {
      const newBranchId = this.signalsService.getBranchSelectedBySidebar()();
      const isAdvanced = this.signalsService.getIsAdvanced();
      if (this.initialBranchId !== undefined && this.initialBranchId !== newBranchId && isAdvanced) {
        this.router.navigateByUrl('/main'); // Navega a la ruta base del 'main' layout
      }
    });
  }

  ngOnInit(): void {
    this.initialBranchId = this.signalsService.getBranchSelectedBySidebar()();
  }
}