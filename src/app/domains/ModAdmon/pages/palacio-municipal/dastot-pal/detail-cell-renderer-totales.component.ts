import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-detail-cell-renderer-totales',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div class="detail-grid-container">
      <div class="detail-header mb-2">
        <h6 class="mb-0" [ngClass]="detailType === 'DEPOSITO' ? 'text-success' : 'text-danger'">
          Detalle de {{ detailType === 'DEPOSITO' ? 'Ingresos' : 'Egresos' }}: {{ params?.data?.nameAccount }}
        </h6>
      </div>
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        [autoGroupColumnDef]="autoGroupColumnDef"
        (gridReady)="onGridReady($event)"
        style="height: 300px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
    }
    .detail-header {
      font-weight: 600;
      color: #495057;
    }
  `]
})
export class DetailCellRendererTotalesComponent {
  params: any;
  rowData: any[] = [];
  gridApi!: GridApi;
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  detailType: string = 'DEPOSITO'; // 'DEPOSITO' for ingresos, 'GASTO' for egresos

  // Nombres de meses en español
  private monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Configuración de la columna de grupo automático
  autoGroupColumnDef: ColDef = {
    headerName: 'Mes / Año',
    minWidth: 200,
    flex: 2,
    cellRendererParams: {
      suppressCount: false,
    },
  };

  colDefs: ColDef[] = [
    {
      field: 'monthYear',
      headerName: 'Mes/Año',
      rowGroup: true,
      hide: true,
      valueGetter: (params) => {
        if (!params.data?.date) return '';
        const date = new Date(params.data.date);
        const monthName = this.monthNames[date.getMonth()];
        const year = date.getFullYear();
        return `${monthName} ${year}`;
      }
    },
    {
      field: 'date',
      headerName: 'Fecha',
      flex: 1,
      valueFormatter: (params) => {
        if (!params.value) return '';
        const date = new Date(params.value);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      }
    },
    {
      field: 'total',
      headerName: 'Total',
      flex: 1,
      aggFunc: 'sum',
      valueFormatter: (params) => {
        if (params.value == null) return '$0.00';
        return '$' + params.value.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      },
      cellStyle: (params) => {
        const color = this.detailType === 'DEPOSITO' ? '#28a745' : '#dc3545';
        return { textAlign: 'right', fontWeight: 'bold', color: color };
      }
    }
  ];

  gridOptions: any = {
    headerHeight: 28,
    rowHeight: 24,
    domLayout: 'autoHeight',
    groupDefaultExpanded: 0, // Grupos contraídos por defecto
    suppressAggFuncInHeader: true, // No mostrar "(sum)" en el header
  };

  agInit(params: any): void {
    this.params = params;
    // Get the detail type from context
    this.detailType = this.params.context?.detailType || 'DEPOSITO';
    this.loadDetailData();
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  async loadDetailData(): Promise<void> {
    const parentData = this.params.data;
    const context = this.params.context;

    console.log('[DetailCellRendererTotales] loadDetailData called');
    console.log('[DetailCellRendererTotales] parentData:', parentData);
    console.log('[DetailCellRendererTotales] context:', context);
    console.log('[DetailCellRendererTotales] detailType:', this.detailType);

    if (!parentData || !context) {
      console.error('Missing parent data or context');
      return;
    }

    const incomesExpensesService = context.incomesExpensesService;
    const idRoot = context.idRoot;
    const startDate = context.startDate;
    const endDate = context.endDate;

    console.log('[DetailCellRendererTotales] Request params:', {
      idRoot,
      detailType: this.detailType,
      nameAccount: parentData.nameAccount,
      startDate,
      endDate
    });

    try {
      const response = await incomesExpensesService.getDetailFromIncomesAndExpenses(
        idRoot,
        this.detailType,
        parentData.nameAccount,
        startDate,
        endDate
      ).toPromise();

      console.log('[DetailCellRendererTotales] Response:', response);

      if (response?.success && response?.hasData) {
        this.rowData = response.data;
        console.log('[DetailCellRendererTotales] rowData set to:', this.rowData);
      } else {
        this.rowData = [];
        console.log('[DetailCellRendererTotales] No data or unsuccessful response');
      }
    } catch (error) {
      console.error('[DetailCellRendererTotales] Error loading detail data:', error);
      this.rowData = [];
    }
  }
}

