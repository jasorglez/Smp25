import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { lastValueFrom } from 'rxjs';
import { ProductionService } from 'app/services/production.service';
import { alerts } from 'app/helpers/alerts';

interface ParamCatalog {
  id: number;
  nombre: string;
  valorMin: number | null;
  valorMax: number | null;
}

@Component({
  selector: 'app-mediciones-bote',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="height:100%;display:flex;flex-direction:column;background:#fff8e1;border-top:2px solid #ffe0b2;">

      <!-- Toolbar -->
      <div style="padding:5px 10px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffe0b2;">
        <span style="font-size:0.8rem;color:#e65100;font-weight:600;">
          <i class="bi bi-clipboard-data me-1"></i>
          Mediciones — <span style="font-weight:400;">{{ folioLabel }}</span>
          <span *ngIf="loading" class="ms-2 text-warning" style="font-size:0.75rem;">
            <i class="bi bi-hourglass-split"></i> Cargando…
          </span>
        </span>
        <div class="d-flex gap-1">
          <button class="btn btn-success btn-sm" style="padding:1px 7px;" (click)="addRow()" [disabled]="!gridApi || loading">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button class="btn btn-primary btn-sm position-relative" style="padding:1px 7px;" (click)="saveChanges()" [disabled]="!hasChanges || loading">
            <i class="bi bi-floppy"></i>
            <span *ngIf="hasChanges" class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"></span>
          </button>
          <button class="btn btn-warning btn-sm" style="padding:1px 7px;" (click)="revert()" [disabled]="loading">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button class="btn btn-danger btn-sm" style="padding:1px 7px;" (click)="deleteRow()" [disabled]="!selectedRow || loading">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <!-- Sin parámetros configurados -->
      <div *ngIf="!loading && colDefs.length === 0"
           style="flex:1;display:flex;align-items:center;justify-content:center;color:#9e9e9e;font-size:0.82rem;text-align:center;padding:16px;">
        <div>
          <i class="bi bi-sliders" style="font-size:1.8rem;display:block;opacity:0.3;margin-bottom:6px;"></i>
          Sin parámetros configurados para esta materia prima.
          <div style="font-size:0.76rem;margin-top:4px;">Ve a Catálogos → Parámetros para habilitarlos.</div>
        </div>
      </div>

      <!-- Grid -->
      <div *ngIf="colDefs.length > 0" style="flex:1 1 auto;min-height:0;">
        <ag-grid-angular
          class="ag-theme-quartz"
          style="width:100%;height:100%;"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onSelectionChanged($event)"
          (cellValueChanged)="onCellValueChanged($event)">
        </ag-grid-angular>
      </div>

    </div>
  `,
})
export class MedicionesBoteComponent implements ICellRendererAngularComp {
  private productionService = inject(ProductionService);

  loading = false;
  folioLabel = '';

  gridApi!: GridApi;
  rowData: any[] = [];
  private originalRowData: any[] = [];
  hasChanges = false;
  selectedRow: any = null;

  colDefs: ColDef[] = [];
  private params: ParamCatalog[] = [];
  private idMoliendaParams: number | null = null;
  private idArticulo:       number | null = null;
  private matPrimaOptions:  { id: number; name: string }[] = [];

  gridOptions: any = {
    getRowId:                       (p: any) => String(p.data.id ?? p.data.__tempId),
    headerHeight:                   24,
    rowHeight:                      22,
    rowSelection:                   'single',
    stopEditingWhenCellsLoseFocus:  true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  // ── ICellRendererAngularComp ──────────────────────────────────────────────

  agInit(params: any): void {
    this.idMoliendaParams = params.data?.id ?? null;
    this.folioLabel       = params.data?.folio ?? '';
    this.idArticulo       = params.context?.idArticulo ?? null;
    this.matPrimaOptions  = params.context?.matPrimaOptions ?? [];
    if (this.idMoliendaParams) this.loadAll();
  }

  refresh(): boolean { return false; }

  // ── Data loading ──────────────────────────────────────────────────────────

  private async loadAll() {
    this.loading = true;
    try {
      const [catalogItems, mediciones] = await Promise.all([
        lastValueFrom(
          this.idArticulo
            ? this.productionService.getMoliendaParamCatalogByArticulo(this.idArticulo)
            : this.productionService.getMoliendaParamCatalog()
        ).catch(() => [] as any[]),
        lastValueFrom(
          this.productionService.getMoliendaMedicionesByParams(this.idMoliendaParams!)
        ).catch(() => [] as any[]),
      ]);

      this.params = (catalogItems as any[]).map((c: any) => ({
        id: c.id, nombre: c.nombre,
        valorMin: c.valorMin ?? null,
        valorMax: c.valorMax ?? null,
      }));

      this.buildColDefs();
      this.buildRowData(mediciones as any[]);
    } catch (e) {
      console.error('Error cargando mediciones:', e);
    } finally {
      this.loading = false;
    }
  }

  private buildColDefs() {
    const fixed: ColDef[] = [
      {
        field: 'fecha', headerName: 'Fecha', editable: true, width: 120,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: { maxLength: 10 },
        valueSetter: (p: any) => { p.data.fecha = p.newValue; p.data.__modified = true; return true; },
      },
      {
        field: 'hora', headerName: 'Hora', editable: true, width: 88,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: { maxLength: 8 },
        valueSetter: (p: any) => { p.data.hora = p.newValue; p.data.__modified = true; return true; },
      },
      {
        field: 'faseFe', headerName: 'Fase FE', editable: true, width: 95,
        valueSetter: (p: any) => { p.data.faseFe = p.newValue; p.data.__modified = true; return true; },
      },
      {
        field: 'idMateriaPrima', headerName: 'Materia Prima', editable: true, width: 170,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: [null, ...this.matPrimaOptions.map(m => m.id)] },
        valueFormatter: (p: any) =>
          p.value == null ? '' : (this.matPrimaOptions.find(m => m.id === p.value)?.name ?? String(p.value)),
        valueSetter: (p: any) => {
          p.data.idMateriaPrima = p.newValue == null ? null : Number(p.newValue);
          p.data.__modified = true; return true;
        },
      },
    ];

    const paramCols: ColDef[] = this.params.map(param => ({
      field: `param_${param.id}`,
      headerName: param.nombre,
      editable: true,
      width: 120,
      cellEditor: 'agNumberCellEditor',
      headerTooltip: [
        param.valorMin != null ? `Mín: ${param.valorMin}` : null,
        param.valorMax != null ? `Máx: ${param.valorMax}` : null,
      ].filter(Boolean).join(' | ') || undefined,
      valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) : '',
      cellStyle: (p: any) => {
        const v = p.value;
        if (v == null) return null;
        const n = Number(v);
        if (param.valorMin != null && n < param.valorMin) return { backgroundColor: '#ffeeba', color: '#856404' };
        if (param.valorMax != null && n > param.valorMax) return { backgroundColor: '#f8d7da', color: '#721c24' };
        return { backgroundColor: '#d4edda', color: '#155724' };
      },
      valueSetter: (p: any) => {
        p.data[`param_${param.id}`] = p.newValue ?? null;
        p.data.__modified = true; return true;
      },
    }));

    this.colDefs = [...fixed, ...paramCols];
  }

  buildRowData(mediciones: any[]) {
    const mapped = mediciones.map((m: any) => {
      const row: any = {
        id: m.id, fecha: m.fecha, hora: m.hora,
        faseFe: m.faseFe ?? '', idMateriaPrima: m.idMateriaPrima ?? null,
        __isNew: false, __modified: false,
      };
      for (const param of this.params) {
        const val = (m.valores ?? []).find((v: any) => v.idParamCatalog === param.id);
        row[`param_${param.id}`] = val?.valor ?? null;
      }
      return row;
    });
    this.originalRowData = JSON.parse(JSON.stringify(mapped));
    this.rowData = mapped;
    if (this.gridApi && !this.gridApi.isDestroyed())
      this.gridApi.setGridOption('rowData', mapped);
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
    if (this.rowData.length) this.gridApi.setGridOption('rowData', this.rowData);
  }

  onSelectionChanged(e: any) {
    const nodes = e.api.getSelectedNodes();
    this.selectedRow = nodes.length ? nodes[0].data : null;
  }

  onCellValueChanged(e: any) {
    this.hasChanges = true;
    if (e.colDef?.field?.startsWith('param_'))
      this.gridApi?.refreshCells({ rowNodes: [e.node], force: true });
  }

  addRow() {
    const today = new Date();
    const fecha = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const hora  = `${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}:00`;
    const newRow: any = {
      id: null, __tempId: `new_${Date.now()}`,
      __isNew: true, __modified: false,
      fecha, hora, faseFe: '', idMateriaPrima: null,
    };
    for (const p of this.params) newRow[`param_${p.id}`] = null;
    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'fecha' }), 50);
    }
  }

  async saveChanges() {
    if (!this.idMoliendaParams) return;
    const toDto = (row: any) => ({
      idMoliendaParams: this.idMoliendaParams!,
      fecha: row.fecha, hora: row.hora,
      faseFe: row.faseFe || undefined,
      idMateriaPrima: row.idMateriaPrima ?? undefined,
      valores: this.params.map(p => ({
        idParamCatalog: p.id,
        valor: row[`param_${p.id}`] ?? undefined,
      })),
    });
    try {
      for (const row of this.rowData.filter(r => r.__isNew))
        await lastValueFrom(this.productionService.createMoliendaMedicion(toDto(row)));
      for (const row of this.rowData.filter(r => r.__modified && !r.__isNew))
        await lastValueFrom(this.productionService.updateMoliendaMedicion(row.id, toDto(row)));
      this.hasChanges = false;
      const mediciones = await lastValueFrom(
        this.productionService.getMoliendaMedicionesByParams(this.idMoliendaParams!)
      ).catch(() => [] as any[]);
      this.buildRowData(mediciones as any[]);
    } catch (e) {
      console.error('Error guardando mediciones:', e);
      alerts.reqErrorToast('Error al guardar');
    }
  }

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasChanges = false;
    this.selectedRow = null;
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteRow() {
    if (!this.selectedRow) return;
    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.selectedRow = null;
      this.hasChanges = this.rowData.some(r => r.__isNew || r.__modified);
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      return;
    }
    try {
      await lastValueFrom(this.productionService.deleteMoliendaMedicion(this.selectedRow.id));
      this.rowData = this.rowData.filter(r => r.id !== this.selectedRow!.id);
      this.originalRowData = this.originalRowData.filter(r => r.id !== this.selectedRow!.id);
      this.selectedRow = null;
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
    } catch (e) {
      console.error('Error eliminando medición:', e);
      alerts.reqErrorToast('Error al eliminar');
    }
  }
}
