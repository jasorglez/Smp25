import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ProvidersService } from 'app/services/providers.service';
import { ProviderQuoteDetailComponent } from './provider-quote-detail.component';

@Component({
  selector: 'app-provider-detail-cell-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ProviderQuoteDetailComponent],
  template: `
    <div class="provider-detail-container">
      <app-provider-quote-detail></app-provider-quote-detail>
    </div>
  `,
  styles: [`
    .provider-detail-container {
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class ProviderDetailCellRendererComponent {

  private params!: ICellRendererParams;
  private context: any;
  private gridApi!: GridApi;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }
}