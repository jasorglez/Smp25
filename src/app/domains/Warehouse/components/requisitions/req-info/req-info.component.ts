import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReceiptsService } from 'app/services/receipts.service';
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
  private receiptsService = inject(ReceiptsService);

  idRequisition = this.signalsService.getIdRequisition();
  requisitionName = this.signalsService.getRequisitionName();
  requisitionSolicitant = this.signalsService.getRequisitionSolicitant();
  requisitionDate = this.signalsService.getRequisitionDate();

  generateOC(idRequisition: number, action: string)
  {
    this.receiptsService.generateOC(idRequisition, action);
  }
}
