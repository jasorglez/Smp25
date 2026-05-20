import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, ICellRendererParams } from 'ag-grid-community';
import { alerts } from 'app/helpers/alerts';
import { runAutosizeAllColumns } from 'app/helpers/ag-grid-autosize.helper';

/**
 * Nivel 4 — Detalle de Empaque del Proveedor.
 *
 * Sub-cascada de DetalleAsignProveedsMaestroComponent que expande UNA sola fila con
 * los 4 campos de empaque (campo2..campo5) por par material-proveedor. Sin botón
 * "Guardar" propio: las ediciones mutan `params.data.campoX` y marcan la fila padre
 * como `__modified = true`, por lo que el botón Guardar del nivel 2 (proveedores)
 * persistirá los cambios igual que cualquier otra edición sobre `proveedorxtablas`.
 */
@Component({
  selector: 'app-detalle-empaque-proveedor',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 10px; background-color: #fff3e0; height: 100%; display: flex; flex-direction: column; box-sizing: border-box;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Descripción del Artículo — Proveedor: {{ providerName }}</strong>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-warning" (click)="revertChanges()">
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button class="btn btn-sm btn-danger" (click)="clearFields()">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          style="width: 100%; flex-grow: 1;"
          class="ag-theme-quartz small-text-ag-grid"
          [columnDefs]="empaqueColumnDefs"
          [rowData]="empaqueRowData"
          [gridOptions]="empaqueGridOptions"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `,
})
export class DetalleEmpaqueProveedorComponent implements ICellRendererAngularComp {
  public params!: ICellRendererParams;
  public providerName: string = '';
  private gridApi!: GridApi;

  /** Snapshot inicial para Deshacer (campo2..campo5 antes de editar). */
  private originalSnapshot: { campo2: string; campo3: any; campo4: string; campo5: string } | null = null;

  /** Única fila del grid: refleja directamente `params.data.campoX`. */
  public empaqueRowData: any[] = [];

  public empaqueGridOptions: any = {
    headerHeight: 25,
    rowHeight: 24,
    suppressClickEdit: false,
    stopEditingWhenCellsLoseFocus: true,
    defaultColDef: {
      filter: false,
      suppressHeaderFilterButton: true,
      floatingFilter: false,
      sortable: false,
    },
    onFirstDataRendered: (params: any) => runAutosizeAllColumns(params.api),
  };

  public empaqueColumnDefs: ColDef[] = [
    {
      field: 'campo2',
      headerName: 'Descripción Empaque',
      editable: true,
      flex: 1,
      minWidth: 220,
      valueSetter: (params: any) => {
        params.data.campo2 = params.newValue ? String(params.newValue).toUpperCase() : '';
        return true;
      }
    },
    {
      field: 'campo3',
      headerName: 'Pieza x Paquete',
      editable: true,
      width: 150,
      // agTextCellEditor (más predecible que agNumberCellEditor). Validamos enteros en el valueSetter.
      cellEditor: 'agTextCellEditor',
      valueFormatter: (params: any) => {
        const v = params.value;
        if (v === null || v === undefined || v === '') return '';
        return String(v);
      },
      valueSetter: (params: any) => {
        const raw = params.newValue;
        // null/undefined del editor: NO sobreescribir el valor existente (evita borrarlo).
        if (raw === null || raw === undefined) return false;
        const s = String(raw).trim();
        // Vaciar la celda explícitamente.
        if (s === '') {
          params.data.campo3 = '';
          return true;
        }
        if (!/^\d+$/.test(s)) {
          alerts.basicAlert(
            'Pieza x Paquete',
            'Solo se permiten números enteros (sin letras ni decimales).',
            'warning'
          );
          return false;
        }
        // El backend espera campo3 como string (es VARCHAR en BD). Guardamos como string
        // pero validamos arriba que sólo sean dígitos para mantener la intención de "entero".
        params.data.campo3 = s;
        return true;
      }
    },
    {
      field: 'campo4',
      headerName: 'Medidas',
      editable: true,
      flex: 1,
      minWidth: 150,
      valueSetter: (params: any) => {
        params.data.campo4 = params.newValue ? String(params.newValue).toUpperCase() : '';
        return true;
      }
    },
    {
      field: 'campo5',
      headerName: 'Peso/Volumen',
      editable: true,
      flex: 1,
      minWidth: 150,
      valueSetter: (params: any) => {
        params.data.campo5 = params.newValue ? String(params.newValue).toUpperCase() : '';
        return true;
      }
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerName = params.data?.providerName || '—';

    // Snapshot para Deshacer (clona los valores actuales antes de cualquier edición).
    this.originalSnapshot = {
      campo2: params.data?.campo2 ?? '',
      campo3: params.data?.campo3 ?? '',
      campo4: params.data?.campo4 ?? '',
      campo5: params.data?.campo5 ?? ''
    };

    // El grid muestra UNA fila que apunta al mismo objeto `params.data`,
    // así las ediciones en el sub-grid se reflejan en la fila padre y
    // el botón Guardar del nivel 2 las persistirá.
    this.empaqueRowData = [params.data];
  }

  refresh(): boolean {
    return false;
  }

  onGridReady(event: any) {
    this.gridApi = event.api;
  }

  /** Marca la fila padre como modificada para que el Guardar del nivel 2 detecte cambios. */
  onCellValueChanged(event: any) {
    if (this.params?.data) {
      this.params.data.__modified = true;
    }
    // Notifica al nivel 2 (DetalleAsignProveedsMaestroComponent) para encender su badge.
    const parent = this.params?.context?.componentParent;
    if (parent && typeof parent.notifyChildChanged === 'function') {
      parent.notifyChildChanged();
    }
  }

  /** Restaura los valores al snapshot inicial. */
  revertChanges(): void {
    if (!this.params?.data || !this.originalSnapshot) return;
    this.params.data.campo2 = this.originalSnapshot.campo2;
    this.params.data.campo3 = this.originalSnapshot.campo3;
    this.params.data.campo4 = this.originalSnapshot.campo4;
    this.params.data.campo5 = this.originalSnapshot.campo5;
    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true });
    }
  }

  /** Vacía los 4 campos. Marca la fila padre como modificada para que el Guardar del nivel 2 la persista vacía. */
  clearFields(): void {
    if (!this.params?.data) return;
    this.params.data.campo2 = '';
    this.params.data.campo3 = '';
    this.params.data.campo4 = '';
    this.params.data.campo5 = '';
    this.params.data.__modified = true;
    const parent = this.params?.context?.componentParent;
    if (parent && typeof parent.notifyChildChanged === 'function') {
      parent.notifyChildChanged();
    }
    if (this.gridApi) {
      this.gridApi.refreshCells({ force: true });
    }
  }
}
