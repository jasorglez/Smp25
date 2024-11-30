import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-req-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './req-info.component.html',
  styleUrl: './req-info.component.scss'
})
export class ReqInfoComponent {
  private signalsService = inject(SignalsService);

  idRequisition = this.signalsService.getIdRequisition();
  requisitionName = this.signalsService.getRequisitionName();
  requisitionSolicitant = this.signalsService.getRequisitionSolicitant();
  requisitionDate = this.signalsService.getRequisitionDate();

}
