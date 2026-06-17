import { Component, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, IDetailCellRendererParams } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { OhBloqueProductosComponent } from './oh-bloque-productos.component';
import { ProductionService } from '../../../../../services/production.service';

@Component({
  selector: 'app-oh-bloque-detail',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  styles: [`:host { display: block; height: 100%; overflow: hidden; position: relative; }`],
  template: `
    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; padding: 6px; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background-color: #e8f5e9;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem; color: #2e7d32;">Configurar Bloques</strong>
        <button class="btn btn-sm btn-primary" (click)="save()">
          <i class="bi bi-floppy"></i> Guardar bloques
        </button>
      </div>
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;"
          [rowData]="rows"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>
  `,
})
export class OhBloqueDetailComponent {
  private productionService = inject(ProductionService);
  private readonly cdr = inject(ChangeDetectorRef);
  private params: IDetailCellRendererParams & { context: any } = {} as any;

  rows: any[] = [];
  private gridApi!: GridApi;
  private activeExpandedNodeId: string | null = null;
  private idOhBloque: number | null = null;

  readonly colDefs: ColDef[] = [
    {
      field: 'enabled', headerName: 'Enabled', width: 90, editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
      valueSetter: (p: any) => { p.data.enabled = p.newValue; return true; },
    },
    { field: 'bloque', headerName: 'Bloque', flex: 1, editable: false },
    {
      field: 'ohMin', headerName: 'OH Mínimo', width: 120, editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 2 },
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) : '',
      valueSetter: (p: any) => { p.data.ohMin = p.newValue != null ? parseFloat(p.newValue) : null; return true; },
    },
    {
      field: 'ohMax', headerName: 'OH Máximo', width: 120, editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 2 },
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) : '',
      valueSetter: (p: any) => { p.data.ohMax = p.newValue != null ? parseFloat(p.newValue) : null; return true; },
    },
    {
      field: 'cantidadTotal',
      headerName: 'Cant. requerida',
      width: 150,
      editable: false,
      cellStyle: { cursor: 'pointer', backgroundColor: '#c8e6c9', color: '#1b5e20', fontWeight: '600' },
      cellRenderer: (p: any) => {
        const total = this.calcTotal(p.data?.productos);
        return total != null
          ? String(total)
          : '<span style="color:#999;font-weight:400">Click para configurar</span>';
      },
      onCellClicked: (event: any) => this.toggleProductosDetail(event.node),
    },
    {
      field: 'cantidadProducidaTotal',
      headerName: 'Total producido',
      width: 150,
      editable: false,
      cellStyle: { backgroundColor: '#e8f5e9', color: '#1b5e20', fontWeight: '600' },
      cellRenderer: (p: any) => {
        const total = this.calcTotalProducida(p.data?.productos);
        return total != null ? String(total) : '';
      },
    },
  ];

  readonly gridOptions: any = {
    getRowId: (p: any) => String(p.data.id),
    headerHeight: 25, rowHeight: 22,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    masterDetail: true,
    detailRowHeight: 160,
    isRowMaster: () => true,
    detailCellRenderer: OhBloqueProductosComponent,
    detailCellRendererParams: (params: any) => ({
      context: {
        productosOptions: this.params.context?.productosOptions ?? [],
        productosDisponibles: this.getProductosDisponibles(params?.data),
        onProductosChanged: (bloqueId: number, productos: any[]) => this.onProductosChanged(bloqueId, productos),
      },
    }),
  };

  agInit(params: IDetailCellRendererParams & { context: any }): void {
    this.params = params;
    this.idOhBloque = params.data?.id ?? null;
  
    this.cdr.detectChanges();}

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    this.loadRows();
  }

  private async loadRows() {
    const bloques: { id: number; bloque: string; productoIds: number[] }[] =
      this.params.context?.bloqueOptions ?? [];

    let saved: Record<number, any> = {};
    try {
      (JSON.parse(this.params.data?.bloqueIds ?? '[]') as any[])
        .forEach((r: any) => saved[r.id] = r);
    } catch {}

    // Cargar cantidades desde la tabla real
    let dbProductos: { idBloqueEf: number; idProducto: number; cantidad: number | null; cantidadProducida: number | null }[] = [];
    if (this.idOhBloque) {
      try {
        const raw = await lastValueFrom(
          this.productionService.getOhBloqueProductosByOhBloque(this.idOhBloque)
        );
        dbProductos = raw ?? [];
      } catch {}
    }

    // Agrupar productos por bloque
    const productosPorBloque = new Map<number, { idProducto: number; cantidad: number | null; cantidadProducida: number | null }[]>();
    for (const p of dbProductos) {
      if (!productosPorBloque.has(p.idBloqueEf)) productosPorBloque.set(p.idBloqueEf, []);
      productosPorBloque.get(p.idBloqueEf)!.push({ idProducto: p.idProducto, cantidad: p.cantidad, cantidadProducida: p.cantidadProducida });
    }

    this.rows = bloques.map(b => {
      const productos = productosPorBloque.get(b.id) ?? [];
      return {
        id:            b.id,
        bloque:        b.bloque,
        enabled:       saved[b.id]?.enabled ?? false,
        ohMin:         saved[b.id]?.ohMin   ?? null,
        ohMax:         saved[b.id]?.ohMax   ?? null,
        productos,
        cantidadTotal: this.calcTotal(productos),
        _productoIds:  b.productoIds,
      };
    });

    this.gridApi.setGridOption('rowData', this.rows);
    this.cdr.detectChanges();
  }

  private getProductosDisponibles(data: any): any[] {
    const all: any[] = this.params.context?.productosOptions ?? [];
    const ids: number[] = data?._productoIds ?? [];
    return ids.length ? all.filter(p => ids.includes(p.id)) : all;
  }

  private toggleProductosDetail(node: any) {
    if (this.activeExpandedNodeId === node.id) {
      node.setExpanded(false);
      this.activeExpandedNodeId = null;
      this.gridApi.forEachNode(n => n.setRowHeight(undefined));
      this.gridApi.onRowHeightChanged();
      return;
    }
    if (this.activeExpandedNodeId) {
      this.gridApi.forEachNode(n => {
        if (n.id === this.activeExpandedNodeId) n.setExpanded(false);
        n.setRowHeight(undefined);
      });
    }
    this.gridApi.forEachNode(n => { if (n.id !== node.id) n.setRowHeight(0); });
    this.activeExpandedNodeId = node.id;
    this.gridApi.onRowHeightChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  onProductosChanged(bloqueId: number, productos: any[]) {
    const row = this.rows.find(r => r.id === bloqueId);
    if (!row) return;
    row.productos = productos;
    row.cantidadTotal = this.calcTotal(productos);
    const node = this.gridApi?.getRowNode(String(bloqueId));
    if (node) this.gridApi.refreshCells({ rowNodes: [node], columns: ['cantidadTotal', 'cantidadProducidaTotal'], force: true });
  }

  private calcTotal(productos: any[]): number | null {
    if (!productos?.length) return null;
    const s = productos.reduce((acc: number, p: any) => acc + (p.cantidad ?? 0), 0);
    return s > 0 ? s : null;
  }

  private calcTotalProducida(productos: any[]): number | null {
    if (!productos?.length) return null;
    const s = productos.reduce((acc: number, p: any) => acc + (p.cantidadProducida ?? 0), 0);
    return s > 0 ? s : null;
  }

  async save() {
    if (!this.idOhBloque) return;

    const data: any[] = [];
    this.gridApi?.forEachNode(n => data.push(n.data));
    const rows = data.length ? data : this.rows;

    // 1. Guardar configuración de bloques (enabled/ohMin/ohMax) en bloque_ids JSON
    const bloqueJson = JSON.stringify(rows.map(r => ({
      id: r.id, bloque: r.bloque, enabled: r.enabled, ohMin: r.ohMin, ohMax: r.ohMax,
    })));

    // 2. Guardar cantidades en tabla oh_bloque_producto
    const items = rows.flatMap(r =>
      (r.productos ?? [])
        .filter((p: any) => p.cantidad != null && p.cantidad > 0)
        .map((p: any) => ({ idBloqueEf: r.id, idProducto: p.idProducto, cantidad: p.cantidad }))
    );

    await lastValueFrom(
      this.productionService.saveOhBloqueProductosBatch(this.idOhBloque, items)
    );

    this.params.context?.onBloqueChanged?.(
      this.params.data?.id,
      this.params.data?.__tempId,
      bloqueJson
    );
  
    this.cdr.detectChanges();}

  refresh(): boolean { return false; }
}
