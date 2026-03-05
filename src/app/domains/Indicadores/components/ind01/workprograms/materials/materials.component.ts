import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './materials.component.html',
  styleUrl: './materials.component.scss'
})
export class MaterialsComponent {
  private signalsService = inject(SignalsService);
  private materialsService = inject(MaterialsService);

  private gridApi: GridApi;
  private idcompany: number = null;

  rowData: any[] = [];
  loading: boolean = false;

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
    flex: 1,
  };

  public columnDefs: ColDef[] = [
    {
      field: 'familiaDescription',
      headerName: 'Familia',
      rowGroup: true,
      hide: true,
    },
    {
      field: 'subfamiliaDescription',
      headerName: 'Subfamilia',
      rowGroup: true,
      hide: true,
    },
    {
      field: 'materialDescription',
      headerName: 'Material',
      minWidth: 200,
    },
    {
      field: 'insumo',
      headerName: 'Código',
      width: 120,
    },
    {
      field: 'medidaDescription',
      headerName: 'Unidad',
      width: 90,
    },
    {
      field: 'costoMN',
      headerName: 'Costo',
      width: 100,
      type: 'numericColumn',
      valueFormatter: (p) =>
        p.value != null
          ? `$${Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
          : '',
    },
    {
      field: 'ventaMN',
      headerName: 'Precio Venta',
      width: 110,
      type: 'numericColumn',
      valueFormatter: (p) =>
        p.value != null
          ? `$${Number(p.value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
          : '',
    },
  ];

  public gridOptions: any = {
    headerHeight: 38,
    rowHeight: 22,
    groupDefaultExpanded: -1,
    suppressDragLeaveHidesColumns: true,
    animateRows: true,
    groupDisplayType: 'groupRows',
  };

  constructor() {
    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      if (currentRoot && currentRoot !== this.idcompany) {
        this.idcompany = currentRoot;
        this.loadMaterials();
      }
    });
  }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
  }

  private loadMaterials() {
    if (!this.idcompany) return;
    this.loading = true;
    this.materialsService.getAllMaterialsxFamilyview(this.idcompany).subscribe({
      next: (data) => {
        this.rowData = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading materials:', err);
        this.loading = false;
      },
    });
  }
}
