import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-prep1-principal',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="height: calc(100vh - 160px); display: flex; flex-direction: column; padding: 8px 0;">
      <ag-grid-angular
        class="ag-theme-quartz"
        style="width: 100%; flex: 1;"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)">
      </ag-grid-angular>
    </div>
  `
})
export class Prep1PrincipalComponent implements OnInit {
  private signalsService = inject(SignalsService);
  private materialsService = inject(MaterialsService);

  private gridApi!: GridApi;
  rowData: any[] = [];

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor() {
    effect(() => {
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      if (idCompany) {
        this.loadMaterials(idCompany);
      }
    });
  }

  ngOnInit() {}

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
    editable: false
  };

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    suppressCellFocus: true
  };

  public colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 60,
      valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      pinned: 'left',
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
      sortable: false,
      filter: false
    },
    {
      field: 'articulo',
      headerName: 'Material',
      flex: 1,
      minWidth: 220,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'categoria',
      headerName: 'Categoría',
      width: 160,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'familia',
      headerName: 'Familia',
      width: 160,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'subfamilia',
      headerName: 'Subfamilia',
      width: 160,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'measure',
      headerName: 'Unidad',
      width: 110,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'stockMin',
      headerName: 'Stock Mín.',
      width: 110,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter'
    },
    {
      field: 'stockMax',
      headerName: 'Stock Máx.',
      width: 110,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter'
    },
    {
      field: 'vigente',
      headerName: 'Vigente',
      width: 90,
      cellRenderer: (params: any) => {
        const el = document.createElement('span');
        el.textContent = params.value ? '✔' : '✘';
        el.style.color = params.value ? '#2e7d32' : '#c62828';
        el.style.fontWeight = 'bold';
        return el;
      },
      filter: false
    }
  ];

  private async loadMaterials(idCompany: number) {
    try {
      const data = await lastValueFrom(this.materialsService.getMaterialsxview(idCompany));
      const list: any[] = Array.isArray(data) ? data : [];
      this.rowData = list.map(m => ({
        id: m.id,
        articulo: m.articulo || m.description || m.insumo || '',
        categoria: m.categoria || m.category || '',
        familia: m.familia || m.family || '',
        subfamilia: m.subfamilia || m.subfamily || '',
        measure: m.measure || '',
        stockMin: m.stockMin ?? null,
        stockMax: m.stockMax ?? null,
        vigente: m.vigente ?? m.active ?? true
      }));
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    const idCompany = this.signalsService.getRootSelectedBySidebar()();
    if (idCompany) {
      this.loadMaterials(idCompany);
    }
  }
}
