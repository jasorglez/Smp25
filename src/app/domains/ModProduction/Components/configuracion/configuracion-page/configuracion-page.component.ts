import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';
import { DetailCellRendererJarabeComponent } from 'app/domains/Almacenes/components/materiales-maestro/details/detail-cell-renderer-jarabe.component';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-configuracion-page',
  standalone: true,
  imports: [CommonModule, AgGridModule, DetailCellRendererJarabeComponent],
  template: `
    <div class="container-fluid p-3" style="height: calc(100vh - 80px); display: flex; flex-direction: column;">
      <div style="margin-bottom: 10px;">
        <h5 class="mb-0">Configuración de Jarabe por Material</h5>
        <small class="text-muted">Haga clic en la columna "Jarabe" para configurar un material</small>
      </div>
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
export class ConfiguracionPageComponent implements OnInit {
  private signalsService = inject(SignalsService);
  private materialsService = inject(MaterialsService);

  private gridApi!: GridApi;
  rowData: any[] = [];
  expandedRowId: string | null = null;

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
    masterDetail: true,
    detailRowHeight: 340,
    isRowMaster: () => true,
    components: {
      detailCellRendererJarabe: DetailCellRendererJarabeComponent
    },
    detailCellRendererSelector: () => ({ component: 'detailCellRendererJarabe' }),
    onCellClicked: (event: any) => {
      if (event.column.getColId() !== 'jarabe') return;

      const node = event.node;
      const api = event.api;

      if (node.expanded && this.expandedRowId === node.id) {
        node.setExpanded(false);
        this.expandedRowId = null;
        api.forEachNode((n: any) => n.setRowHeight(undefined));
        api.onRowHeightChanged();
      } else {
        api.forEachNode((n: any) => {
          if (n.id !== node.id) {
            n.setExpanded(false);
            n.setRowHeight(undefined);
          }
        });
        this.expandedRowId = node.id;
        api.onRowHeightChanged();
        setTimeout(() => node.setExpanded(true), 0);
      }
    }
  };

  public colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 60,
      valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      pinned: 'left',
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
    },
    {
      field: 'articulo',
      headerName: 'Material',
      flex: 1,
      minWidth: 220,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'familia',
      headerName: 'Familia',
      width: 180,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'subfamilia',
      headerName: 'Subfamilia',
      width: 180,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'jarabe',
      headerName: 'Jarabe',
      width: 110,
      sortable: false,
      filter: false,
      cellRenderer: () => '⚗️ Config',
      cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline', textAlign: 'center' }
    }
  ];

  private async loadMaterials(idCompany: number) {
    try {
      const data = await lastValueFrom(this.materialsService.getMaterialsxview(idCompany));
      const list: any[] = Array.isArray(data) ? data : [];
      this.rowData = list.map(m => ({
        id: m.id,
        articulo: m.articulo || m.description || m.insumo || '',
        familia: m.familia || m.family || '',
        subfamilia: m.subfamilia || m.subfamily || ''
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
