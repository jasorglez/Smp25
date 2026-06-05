import { Component, OnInit, OnChanges, SimpleChanges, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';

@Component({
  selector: 'app-partes-limpieza',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 5px; background-color: #fce4ec; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      <div style="margin-bottom: 4px; flex-shrink: 0;">
        <strong style="color: #c62828; font-size: 0.82rem;">🧹 Actividades</strong>
      </div>
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          [localeText]="AG_GRID_LOCALE_ES"
          (gridReady)="onGridReady($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`]
})
export class PartesLimpiezaComponent implements OnInit, OnChanges {
  @Input() params: any;
  private internalParams: any;
  private gridApi!: GridApi;

  rowData: any[] = [];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    animateRows: true,
    rowSelection: 'single',
  };

  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => p.node.rowIndex + 1,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      width: 250,
      editable: true,
      cellEditor: 'agTextCellEditor',
    },

    {
      field: 'parte',
      headerName: 'Realizó',
      width: 150,
      editable: false,
      cellRenderer: (p: any) => {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!p.value;
        input.style.cursor = 'pointer';
        input.addEventListener('change', () => {
          p.data.parte = input.checked;
          if (p.api) p.api.refreshCells({ rowNodes: [p.node], columns: ['parte'] });
        });
        return input;
      },
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
    },
  

    
  ];

  ngOnInit() { this.loadData(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['params'] && this.params) {
      this.internalParams = this.params;
      if (this.gridApi) this.loadData();
    }
  }

  agInit(params: any): void {
    this.params = params;
    this.internalParams = params;
    if (this.gridApi) this.loadData();
  }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
    this.loadData();
  }

  private loadData() {
    this.rowData = [
      { id: 1, parte: true,  descripcion: 'Limpieza interior con agua caliente', cantidad: 1.00 },
      { id: 2, parte: false, descripcion: 'Desmontaje y desinfección',            cantidad: 2.00 },
      { id: 3, parte: true,  descripcion: 'Circulación de solución cáustica',      cantidad: 15.50 },
    ];
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }
}
