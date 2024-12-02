import { Component, inject } from '@angular/core';
import { ReceiptsService } from 'app/services/receipts.service';
import { SignalsService } from 'app/services/signals.service';
import { OCMainComponent } from "./main/main.component";
import { DetailsComponent } from "./details/details.component";

@Component({
  selector: 'app-purchaseorder',
  standalone: true,
  imports: [OCMainComponent, DetailsComponent],
  templateUrl: './purchaseorder.component.html',
  styleUrl: './purchaseorder.component.scss'
})
export class PurchaseorderComponent {

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
