import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'app/shared/shared.module';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SignalsService } from 'app/services/signals.service';
import { BranchsService } from 'app/services/branchs.service';

@Component({
  selector: 'app-procmenulogistica',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, SharedModule, DomainsModule],
  templateUrl: './procmenulogistica.component.html',
  styleUrl: './procmenulogistica.component.scss'
})
export class ProcmenulogisticaComponent {
  private signalsService = inject(SignalsService);
  private branchesService = inject(BranchsService);

  constructor() {
    effect(() => {
      const currentBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (!currentBranch || currentBranch === 0 || currentBranch === undefined) {
        this.initializeBranch();
      }
    }, { allowSignalWrites: true });
  }

  private initializeBranch() {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (idRoot) {
      this.branchesService.getBrancheswoa(idRoot).subscribe({
        next: (branches: any[]) => {
          if (branches && branches.length > 0) {
            this.signalsService.setBranchSelectedBySidebar(branches[0].id);
          }
        },
        error: (err) => console.error('Error initializing branch:', err)
      });
    }
  }
}