import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-billing',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #e9ecef; height: 100%; display: flex; flex-direction: column;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px;">
          <strong>Facturación Electrónica de: {{ customerName }}</strong>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="billingColumnDefs"
          [rowData]="billingRowData"
          [gridOptions]="billingGridOptions"
          (gridReady)="onBillingGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererBillingComponent implements ICellRendererAngularComp {
  params: any;
  customerId: number;
  customerName: string;

  billingRowData: any[] = [];
  billingGridApi: any;

  billingGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  billingColumnDefs = [
    {
      field: 'regimenFiscal',
      headerName: 'Régimen Fiscal',
      editable: false,
      width: 150,
      flex: 1,
      valueFormatter: (params) => {
        if (!params.value) return '';
        const fiscalRegimes = this.params?.context?.fiscalRegimes || [];
        const found = fiscalRegimes.find((fr: any) => fr.id === params.value);
        return found ? `${found.id} - ${found.description}` : params.value;
      }
    },
    {
      field: 'usoCfdi',
      headerName: 'Uso CFDI',
      editable: false,
      width: 150,
      flex: 1,
      valueFormatter: (params) => {
        if (!params.value) return '';
        const usosFactura = this.params?.context?.usosFactura || [];
        const found = usosFactura.find((uf: any) => uf.cUsoCFDI === params.value);
        return found ? `${found.cUsoCFDI} - ${found.descripcion}` : params.value;
      }
    },
    {
      field: 'codigoPostal',
      headerName: 'CP',
      editable: false,
      width: 100
    },
    {
      field: 'rfc',
      headerName: 'RFC',
      editable: false,
      width: 120
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.customerId = params.data.id;
    this.customerName = params.data.company || params.data.nameContact;

    // Filter billing data for this customer
    const customersBilling = params?.context?.customersBilling || [];
    this.billingRowData = customersBilling.filter((billing: any) => billing.idCustomer === this.customerId);
  }

  refresh(): boolean {
    return false;
  }

  onBillingGridReady(params: any) {
    this.billingGridApi = params.api;
    params.api.sizeColumnsToFit();
  }
}
