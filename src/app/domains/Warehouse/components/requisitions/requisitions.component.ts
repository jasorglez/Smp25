import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RequisitionsMainComponent } from "./main/main.component";
import { RequisitionsDetailsComponent } from "./details/details.component";
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-requisitions',
  standalone: true,
  imports: [CommonModule,TranslateModule, RequisitionsMainComponent, RequisitionsDetailsComponent],
  templateUrl: './requisitions.component.html',
  styleUrl: './requisitions.component.scss'
})
export class RequisitionsComponent {

  private signalsService = inject(SignalsService);

  idRequisition = this.signalsService.getIdRequisition();


}
