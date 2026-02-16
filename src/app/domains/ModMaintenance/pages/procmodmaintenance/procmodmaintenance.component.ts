import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-procmodmaintenance',
  standalone: true,
  imports: [CommonModule, RouterModule, DomainsModule],
  templateUrl: './procmodmaintenance.component.html',
  styleUrl: './procmodmaintenance.component.scss'
})
export class ProcmodmaintenanceComponent implements OnInit {
  private signalsService = inject(SignalsService);
  idBranch: number = 0;

  constructor() {
    effect(() => {
      const branch = this.signalsService.getBranchSelectedBySidebar()();
      this.idBranch = branch !== null && branch !== undefined ? Number(branch) : 0;
    });
  }

  ngOnInit(): void {
  }

  getCurrentDate(): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString('es-ES', options);
  }
}
