import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-provedoor-by-branch',
  standalone: true,
  imports: [],
  templateUrl: './ProvedoorByBranch.component.html',
})
export class ProvedoorByBranchComponent { 
  public idMaterial = signal<number>(0);
  private signalsService = inject(SignalsService);
  
}
