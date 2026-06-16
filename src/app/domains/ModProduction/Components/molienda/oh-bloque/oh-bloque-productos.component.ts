import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, IDetailCellRendererParams } from 'ag-grid-enterprise';

@Component({
  selector: 'app-oh-bloque-productos',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  styles: [`:host { display: block; height: 100%; overflow: hidden; position: relative; }`],
  template: `
    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; padding: 6px; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background-color: #fff8e1;">
      <div style="display: flex; align-items: center; margin-bottom: 5px; flex-shrink: 0;">
        <strong style="font-size: 0.82rem; color: #e65100;">Productos del bloque</strong>
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
export class OhBloqueProductosComponent {
  private params: IDetailCellRendererParams & { context: any } = {} as any;
  rows: any[] = [];
  private gridApi!: GridApi;

  readonly colDefs: ColDef[] = [
    {
      field: 'idProducto', headerName: 'Producto', flex: 1, editable: false,
      valueFormatter: (p: any) => {
        const opts: any[] = this.params.context?.productosOptions ?? [];
        const found = opts.find((o: any) => o.id === p.value);
        return found ? `${found.categoria} - ${found.producto}` : String(p.value ?? '');
      },
    },
    {
      field: 'cantidad', headerName: 'Cantidad', width: 140, editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 0 },
      valueFormatter: (p: any) => p.value != null ? Math.round(p.value).toString() : '',
      valueSetter: (p: any) => {
        p.data.cantidad = p.newValue != null ? Math.round(p.newValue) : null;
        return true;
      },
    },
    {
      field: 'cantidadProducida', headerName: 'Cantidad producida', width: 150, editable: false,
      cellStyle: { backgroundColor: '#e8f5e9', color: '#1b5e20', fontWeight: '600' },
      valueFormatter: (p: any) => p.value != null ? Math.round(p.value).toString() : '',
    },
  ];

  readonly gridOptions: any = {
    headerHeight: 25, rowHeight: 22,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    onCellValueChanged: () => this.notifyParent(),
  };

  agInit(params: IDetailCellRendererParams & { context: any }): void {
    this.params = params;
    const disponibles: { id: number }[] = params.context?.productosDisponibles ?? [];
    const saved: { idProducto: number; cantidad: number | null }[] = params.data?.productos ?? [];
    const savedMap = new Map(saved.map((s: any) => [s.idProducto, s.cantidad]));
    const producidaMap = new Map(saved.map((s: any) => [s.idProducto, s.cantidadProducida]));
    this.rows = disponibles.map(p => ({
      idProducto: p.id,
      cantidad: savedMap.get(p.id) ?? null,
      cantidadProducida: producidaMap.get(p.id) ?? null,
    }));
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    this.gridApi.setGridOption('rowData', this.rows);
  }

  private notifyParent() {
    const data: any[] = [];
    this.gridApi?.forEachNode(n => data.push({ ...n.data }));
    this.params.context?.onProductosChanged?.(this.params.data?.id, data);
  }

  refresh(): boolean { return false; }
}
