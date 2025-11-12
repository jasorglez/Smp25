import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-detail-cell-renderer-costos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 10px; background-color: #e8f5e9; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Desglose de Costos para: {{ materialName }}</strong>
          <!-- Aquí puedes agregar botones si los necesitas en el futuro -->
        </div>
        <ag-grid-angular
          style="width: 100%; flex-grow: 1;"
          class="ag-theme-quartz small-text-ag-grid"
          [columnDefs]="costosColumnDefs"
          [rowData]="costosRowData"
          [gridOptions]="costosGridOptions"
          (gridReady)="onGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>
  `,
})
export class DetailCellRendererCostosComponent implements ICellRendererAngularComp {
  public params!: ICellRendererParams;
  public materialName: string = '';
  private gridApi!: GridApi;

  public costosRowData: any[] = [];
  public costosGridOptions = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single' as const,
  };

  public costosColumnDefs: ColDef[] = [];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialName = params.data.articulo || 'N/A';

    // Generar 11 columnas dinámicamente
    this.costosColumnDefs = Array.from({ length: 11 }, (_, i) => ({
      headerName: `Columna ${i + 1}`,
      field: `col${i + 1}`,
      width: 120,
      editable: true,
      flex: 1
    }));

    // Generar datos falsos para el grid de costos
    this.costosRowData = this.generateFakeCostData(5); // Generar 5 filas de ejemplo
  }

  refresh(): boolean {
    return false;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  private generateFakeCostData(rowCount: number): any[] {
    const data = [];
    for (let i = 0; i < rowCount; i++) {
      const row: any = {};
      for (let j = 0; j < 11; j++) {
        row[`col${j + 1}`] = `Dato ${i + 1}-${j + 1}`;
      }
      data.push(row);
    }
    return data;
  }
}