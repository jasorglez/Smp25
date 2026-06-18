import { Component, effect, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { forkJoin } from 'rxjs';
import { ProductionService } from '../../../../../services/production.service';
import { SignalsService } from '../../../../../services/signals.service';
import { BranchsService } from '../../../../../services/branchs.service';
import { MaterialsService } from '../../../../../services/materials.service';
import { MaterialXModuloService } from '../../../../../services/materialxmodulo.service';
import { OhBloqueCantDetailComponent } from './oh-bloque-cant-detail.component';

@Component({
  selector: 'app-oh-bloque',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div class="col-12">
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        style="width:100%; height:80vh;"
        [rowData]="rows"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        (selectionChanged)="onSelectionChanged($event)">
      </ag-grid-angular>
    </div>
  `,
})
export class OhBloqueComponent {
  private productionService = inject(ProductionService);
  private signalsService    = inject(SignalsService);
  private branchsService    = inject(BranchsService);
  private materialsService  = inject(MaterialsService);
  private mxmService        = inject(MaterialXModuloService);
  private readonly cdr      = inject(ChangeDetectorRef);

  gridApi!: GridApi;
  rows: any[] = [];
  selectedRow: any = null;
  idCompany = 0;

  private branchMap   = new Map<number, string>();
  private matPrimaMap = new Map<number, string>();
  private productosOptions: { id: number; producto: string; categoria: string }[] = [];
  private activeExpandedNodeId: string | null = null;

  constructor() {
    effect(() => {
      const id = this.signalsService.getRootSelectedBySidebar()();
      if (id && id !== this.idCompany) {
        this.idCompany = id;
        this.loadAll();
      }
    });
  }

  readonly colDefs: ColDef[] = [
    {
      field: 'idBranch', headerName: 'Sucursal', width: 160, editable: false,
      valueFormatter: (p: any) => p.value != null ? (this.branchMap.get(p.value) ?? String(p.value)) : '',
    },
    {
      field: 'bloque', headerName: 'Bloque', width: 90, editable: false,
      type: 'numericColumn',
    },
    {
      field: 'idMatPrima', headerName: 'Materia Prima', flex: 1, editable: false,
      valueFormatter: (p: any) => p.value != null ? (this.matPrimaMap.get(p.value) ?? String(p.value)) : '',
    },
    {
      field: 'ohMin', headerName: 'OH Mínimo', width: 110, editable: false,
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) : '',
    },
    {
      field: 'ohMax', headerName: 'OH Máximo', width: 110, editable: false,
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) : '',
    },
    {
      field: 'productoIds', headerName: 'Productos', flex: 2, editable: false,
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        try {
          const ids: number[] = JSON.parse(p.value);
          return ids
            .map(id => this.productosOptions.find(o => o.id === id))
            .filter(Boolean)
            .map(o => o!.producto)
            .join(', ');
        } catch { return ''; }
      },
    },
    {
      field: 'cantidadTotal', headerName: 'Cant. Requerida', width: 130, editable: false,
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value != null ? String(p.value) : '',
      cellStyle: { backgroundColor: '#c8e6c9', color: '#1b5e20', fontWeight: '600', cursor: 'pointer' },
      onCellDoubleClicked: (e: any) => this.toggleDetail(e.node),
    },
  ];

  readonly gridOptions: any = {
    getRowId: (p: any) => String(p.data.id),
    headerHeight: 25, rowHeight: 22,
    rowSelection: 'single',
    stopEditingWhenCellsLoseFocus: true,
    rowClassRules: { 'inactive-row': (p: any) => p.data?.active === false },
    masterDetail: true,
    detailRowHeight: Math.max(150, window.innerHeight * 0.8 - 60),
    isRowMaster: () => true,
    isExternalFilterPresent: () => this.activeExpandedNodeId !== null,
    doesExternalFilterPass: (node: any) => node.id === this.activeExpandedNodeId,
    detailCellRenderer: OhBloqueCantDetailComponent,
    detailCellRendererParams: () => ({
      context: {
        productosOptions: this.productosOptions,
        onCantidadChanged: (idBloqueEf: number, total: number | null) => {
          const row = this.rows.find(r => r.id === idBloqueEf);
          if (!row) return;
          row.cantidadTotal = total;
          this.gridApi.applyTransaction({ update: [row] });
        },
      },
    }),
  };

  private toggleDetail(node: any) {
    if (this.activeExpandedNodeId === node.id) {
      node.setExpanded(false);
      this.activeExpandedNodeId = null;
      this.gridApi.onFilterChanged();
      return;
    }
    if (this.activeExpandedNodeId) {
      this.gridApi.getRowNode(this.activeExpandedNodeId)?.setExpanded(false);
    }
    this.activeExpandedNodeId = node.id;
    this.gridApi.onFilterChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    this.gridApi.setGridOption('rowData', this.rows);
  }

  onSelectionChanged(e: any) {
    const nodes = e.api.getSelectedNodes();
    this.selectedRow = nodes.length ? nodes[0].data : null;
  }

  private loadAll() {
    if (!this.idCompany) return;
    forkJoin({
      bloques:   this.productionService.getMoliendaBloqueEFByCompany(this.idCompany),
      productos: this.productionService.getProductosTerminadosEF(this.idCompany),
      branches:  this.branchsService.getBranches(this.idCompany),
      mats:      this.materialsService.getMaterialsxview(this.idCompany),
      totales:   this.productionService.getOhBloqueProductoTotalsByCompany(this.idCompany),
    }).subscribe(({ bloques, productos, branches, mats, totales }: any) => {
      this.branchMap.clear();
      (branches ?? []).forEach((b: any) => this.branchMap.set(b.id, b.name ?? b.nombre ?? ''));

      this.matPrimaMap.clear();
      (mats ?? []).forEach((m: any) => { if (m.id != null) this.matPrimaMap.set(m.id, m.articulo ?? ''); });

      this.productosOptions = productos ?? [];

      const totalesMap = new Map<number, number>();
      (totales ?? []).forEach((t: any) => totalesMap.set(t.idBloqueEf, t.cantidadTotal));

      this.rows = (bloques ?? []).map((b: any) => ({
        ...b,
        cantidadTotal: totalesMap.get(b.id) ?? null,
      }));
      this.gridApi?.setGridOption('rowData', this.rows);
      setTimeout(() => this.gridApi?.autoSizeAllColumns(), 0);
      this.cdr.detectChanges();
    });
  }
}
