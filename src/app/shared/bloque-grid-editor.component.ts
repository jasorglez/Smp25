import { inject, Component, ElementRef, ViewChild, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ICellEditorAngularComp } from 'ag-grid-angular';

export interface BloqueRow {
  id: number;
  bloque: string;
  enabled: boolean;
  ohMin: number | null;
  ohMax: number | null;
  cantidad: number | null;
}

@Component({
  selector: 'app-bloque-grid-editor',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div class="bge-container" #container>
      <div class="bge-header">Configurar Bloques</div>
      <ag-grid-angular
        class="ag-theme-alpine"
        style="width: 560px; height: 260px;"
        [rowData]="rows"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)">
      </ag-grid-angular>
      <div class="bge-footer">
        <button class="btn btn-sm btn-primary" (click)="confirm()">Aceptar</button>
        <button class="btn btn-sm btn-secondary ms-1" (click)="cancel()">Cancelar</button>
      </div>
    </div>
  `,
  styles: [`
    .bge-container {
      background: #fff; border: 1px solid #dee2e6; border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18); overflow: hidden; z-index: 9999;
    }
    .bge-header {
      background: #e3f2fd; border-bottom: 1px solid #90caf9;
      padding: 6px 12px; font-size: 0.78rem; font-weight: 600; color: #1565c0;
    }
    .bge-footer {
      display: flex; justify-content: flex-end; gap: 6px;
      padding: 6px 10px; border-top: 1px solid #e9ecef; background: #f8f9fa;
    }
  `]
})
export class BloqueGridEditorComponent implements ICellEditorAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  private params: any;
  rows: BloqueRow[] = [];
  private gridApi!: GridApi;

  readonly colDefs: ColDef[] = [
    {
      field: 'enabled', headerName: 'Enabled', width: 80,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
      valueSetter: (p: any) => { p.data.enabled = p.newValue; return true; },
    },
    {
      field: 'bloque', headerName: 'Bloque', flex: 1, editable: false,
    },
    {
      field: 'ohMin', headerName: 'OH Mínimo', width: 110, editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 2 },
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) : '',
      valueSetter: (p: any) => { p.data.ohMin = p.newValue != null ? parseFloat(p.newValue) : null; return true; },
    },
    {
      field: 'ohMax', headerName: 'OH Máximo', width: 110, editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 2 },
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) : '',
      valueSetter: (p: any) => { p.data.ohMax = p.newValue != null ? parseFloat(p.newValue) : null; return true; },
    },
    {
      field: 'cantidad', headerName: 'Cant. requerida', width: 130, editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 0 },
      valueFormatter: (p: any) => p.value != null ? Math.round(p.value).toString() : '',
      valueSetter: (p: any) => { p.data.cantidad = p.newValue != null ? Math.round(p.newValue) : null; return true; },
    },
  ];

  readonly gridOptions: any = {
    headerHeight: 24, rowHeight: 24,
    stopEditingWhenCellsLoseFocus: false,
    singleClickEdit: true,
  };

  agInit(params: any): void {
    this.params = params;
    const bloques: { id: number; bloque: string }[] = params.bloques ?? [];

    let saved: Record<number, Partial<BloqueRow>> = {};
    try { (JSON.parse(params.value ?? '[]') as BloqueRow[]).forEach(r => saved[r.id] = r); } catch {}

    this.rows = bloques.map(b => ({
      id: b.id,
      bloque: b.bloque,
      enabled: saved[b.id]?.enabled ?? false,
      ohMin:   saved[b.id]?.ohMin   ?? null,
      ohMax:   saved[b.id]?.ohMax   ?? null,
      cantidad: saved[b.id]?.cantidad ?? null,
    }));
  
    this.cdr.detectChanges();}

  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }

  isPopup(): boolean { return true; }

  getValue(): string {
    const data: BloqueRow[] = [];
    this.gridApi?.forEachNode(n => data.push(n.data));
    return JSON.stringify(data.length ? data : this.rows);
  }

  confirm(): void { this.params.stopEditing(); }
  cancel(): void  { this.params.stopEditing(true); }
}
