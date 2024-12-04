import { Component, inject } from '@angular/core';
import { ReceiptsService } from 'app/services/receipts.service';
import { SignalsService } from 'app/services/signals.service';
import { OCMainComponent } from "./main/main.component";
import { DetailsComponent } from "./details/details.component";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-purchaseorder',
  standalone: true,
  imports: [OCMainComponent, DetailsComponent, CommonModule],
  templateUrl: './purchaseorder.component.html',
  styleUrl: './purchaseorder.component.scss'
})
export class PurchaseorderComponent {

  private signalsService = inject(SignalsService);

  ngOnInit() {
    this.signalsService.deleteRequisitionData();
  }

  idRequisition = this.signalsService.getIdRequisition();

}
