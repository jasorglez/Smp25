import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, IDetailCellRendererParams } from 'ag-grid-enterprise';
import { ProductionService } from '../../../../../services/production.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-oh-bloque-cant-detail',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  styles: [`:host { display: block; height: 100%; overflow: hidden; position: relative; }`],
  template: `
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;padding:6px;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;background:#e3f2fd;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;flex-shrink:0;">
        <strong style="font-size:0.82rem;color:#1565c0;">Cantidad requerida por producto</strong>
        <button class="btn btn-sm btn-primary" style="font-size:0.75rem;" (click)="save()" [disabled]="!hasChanges">
          <i class="bi bi-floppy"></i> Guardar
        </button>
      </div>
      <div style="flex:1 1 auto;min-height:0;position:relative;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width:100%;height:100%;position:absolute;top:0;left:0;right:0;bottom:0;"
          [rowData]="rows"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellChanged()">
        </ag-grid-angular>
      </div>
    </div>
  `,
})
export class OhBloqueCantDetailComponent {
  private productionService = inject(ProductionService);
  private cdr               = inject(ChangeDetectorRef);
  private params: IDetailCellRendererParams & { context: any } = {} as any;

  rows: any[] = [];
  hasChanges  = false;
  private gridApi!: GridApi;
  private idBloqueEf!: number;

  readonly colDefs: ColDef[] = [
    {
      field: 'producto', headerName: 'Producto', flex: 1, editable: false,
    },
    {
      field: 'cantidad', headerName: 'Cantidad', width: 130, editable: true,
      type: 'numericColumn',
      cellEditor: 'agNumberCellEditor',
      singleClickEdit: true,
      valueParser: (p: any) => { const n = parseInt(p.newValue, 10); return isNaN(n) ? null : n; },
      valueSetter: (p: any) => {
        const n = parseInt(p.newValue, 10);
        p.data.cantidad = isNaN(n) ? null : n;
        return true;
      },
      valueFormatter: (p: any) => p.value != null ? String(p.value) : '',
    },
  ];

  readonly gridOptions: any = {
    headerHeight: 25, rowHeight: 22,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
  };

  agInit(params: IDetailCellRendererParams & { context: any }): void {
    this.params    = params;
    this.idBloqueEf = params.data?.id;
    this.loadRows();
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    this.gridApi.setGridOption('rowData', this.rows);
  }

  onCellChanged() { this.hasChanges = true; }

  async save() {
    const data: any[] = [];
    this.gridApi?.forEachNode(n => { if (n.data) data.push(n.data); });

    const items = data
      .filter(r => r.idProducto != null && r.cantidad != null)
      .map(r => ({ idProducto: r.idProducto, cantidad: r.cantidad }));

    await lastValueFrom(this.productionService.saveCatalogBatchByBloqueEf(this.idBloqueEf, items));

    const total = items.reduce((s, r) => s + (r.cantidad ?? 0), 0);
    this.hasChanges = false;
    this.cdr.detectChanges();

    setTimeout(() => this.params.context?.onCantidadChanged?.(this.idBloqueEf, total || null), 0);
  }

  private async loadRows() {
    if (!this.idBloqueEf) return;

    const productosOptions: { id: number; producto: string; categoria: string }[] = this.params.context?.productosOptions ?? [];

    let catalogIds: number[] = [];
    try { catalogIds = JSON.parse(this.params.data?.productoIds ?? '[]'); } catch {}

    let saved: any[] = [];
    try {
      saved = await lastValueFrom(this.productionService.getOhBloqueProductosByBloqueEf(this.idBloqueEf));
    } catch {}
    const savedMap = new Map<number, any>(saved.map((r: any) => [r.idProducto, r]));

    this.rows = catalogIds.map(id => {
      const opt = productosOptions.find(p => p.id === id);
      const rec = savedMap.get(id);
      return {
        idProducto: id,
        producto:   opt ? `${opt.categoria} - ${opt.producto}` : String(id),
        cantidad:   rec?.cantidad ?? null,
      };
    });

    this.gridApi?.setGridOption('rowData', this.rows);
    this.cdr.detectChanges();
  }

  refresh(): boolean { return false; }
}
