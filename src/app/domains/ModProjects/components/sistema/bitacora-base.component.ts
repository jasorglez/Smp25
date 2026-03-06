import { Directive, inject, Input, OnInit } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { LogbookService }      from 'app/services/logbook.service';
import { DailyReportService }  from 'app/services/daily-report.service';
import { PosicionesService }   from 'app/services/posiciones.service';
import { MaterialsService }    from 'app/services/materials.service';
import { SignalsService }      from 'app/services/signals.service';
import { TrackingService }     from 'app/services/tracking.service';
import { alerts }              from 'app/helpers/alerts';

// ── Helpers de fecha ─────────────────────────────────────────────────────────
export const fmtDate = (val: any): string => {
  if (!val) return '';
  const dateOnly = String(val).substring(0, 10);
  const d = new Date(dateOnly + 'T00:00:00');
  return isNaN(d.getTime()) ? String(val)
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const toIsoDate = (val: any): string => {
  if (!val) return new Date().toISOString().split('T')[0];
  const str = String(val).trim();
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  return new Date().toISOString().split('T')[0];
};

export const DATE_COL = (): ColDef => ({
  field: 'date', headerName: 'Fecha', width: 115, editable: true,
  valueFormatter: (p) => fmtDate(p.value),
  valueParser:    (p) => toIsoDate(p.newValue),
  cellEditorParams: { useFormatter: true },
});

// ── Template compartido ───────────────────────────────────────────────────────
export const BITACORA_TEMPLATE = `
<div class="detail-grid-container">
  <div class="detail-actions d-flex align-items-center mb-2 gap-1">
    <button class="btn btn-outline-secondary btn-sm" (click)="closeDetail()">
      <i class="bi bi-x-lg"></i>
    </button>
    <button class="btn btn-primary btn-sm" (click)="addRow()">
      <i class="bi bi-plus-lg"></i>
    </button>
    <button class="btn btn-warning btn-sm" (click)="discardChanges()">
      <i class="bi bi-arrow-counterclockwise"></i>
    </button>
    <button class="btn btn-danger btn-sm" (click)="deleteSelected()">
      <i class="bi bi-trash"></i>
    </button>
    <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()">
      <i class="bi bi-floppy"></i>
      <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
        *ngIf="hasUnsavedChanges"></span>
    </button>
  </div>
  <ag-grid-angular
    class="ag-theme-quartz small-text-ag-grid"
    [rowData]="rowData"
    [columnDefs]="colDefs"
    [defaultColDef]="defaultColDef"
    [gridOptions]="gridOptions"
    (gridReady)="onGridReady($event)"
    (cellValueChanged)="onCellValueChanged($event)"
    (cellEditingStopped)="onCellEditingStopped($event)"
    (cellClicked)="onCellClicked($event)"
    (cellDoubleClicked)="onCellDoubleClicked($event)"
    (selectionChanged)="onSelectionChanged($event)"
    style="height: 300px; width: 100%;">
  </ag-grid-angular>
</div>
`;

export const BITACORA_STYLES = [
  `.detail-grid-container { padding: 5px; background-color: #f8f9fa; border-radius: 4px; }`,
  `.gap-1 { gap: 4px !important; }`,
  `.editing-cell { background-color: #fff3cd !important; }`,
  `.ag-cell.editing-cell { background-color: #fff3cd !important; }`,
  `.ag-cell { white-space: pre-wrap !important; word-wrap: break-word !important; }`,
  `.ag-theme-quartz .ag-cell { white-space: pre-wrap !important; }`,
];

// ── Clase base abstracta ──────────────────────────────────────────────────────
@Directive()
export abstract class BitacoraBaseComponent implements OnInit, ICellRendererAngularComp {
  @Input() data: any;

  protected logbookService    = inject(LogbookService);
  protected dailyReportService = inject(DailyReportService);
  protected posicionesService  = inject(PosicionesService);
  protected materialsService   = inject(MaterialsService);
  protected signalsService     = inject(SignalsService);
  protected trackingService    = inject(TrackingService);

  @Input() context: any = null;
  protected gridApi!: GridApi;
  protected enterPressed = false;

  rowData: any[]       = [];
  hasUnsavedChanges    = false;
  selectedRowData: any = null;
  reportData: any      = null;
  tempIdCounter        = 0;
  posicionesValues: string[] = [];
  materialesCatalog: any[]   = [];

  // ── Cada hijo define estos miembros ─────────────────────────────────────
  abstract readonly bitacoraType:  string;   // 'personal' | 'material' | ...
  abstract readonly typeNoteValue: string;   // 'PERSONAL' | 'MATERIAL' | ...
  abstract readonly editableCols:  string[];
  abstract readonly requiredFields: { field: string; label: string }[];
  abstract get colDefs(): ColDef[];
  abstract buildPayload(item: any): any;

  // ── Columna por defecto con Enter-nav ────────────────────────────────────
  readonly defaultColDef: ColDef = {
    sortable: true, resizable: true,
    cellClassRules: {
      'editing-cell': (params: any) => params.editing,
    },
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    },
  };

  readonly gridOptions: any = {
    headerHeight: 30, rowHeight: 30, rowSelection: 'single',
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  // ── AG Grid cell-renderer lifecycle ─────────────────────────────────────
  agInit(params: ICellRendererParams): void {
    this.data       = params.data;
    this.context    = params.context;
    this.reportData = params.data;
  }

  refresh(params: ICellRendererParams): boolean {
    this.data = params.data; this.reportData = params.data;
    return true;
  }

  // ── Angular lifecycle ────────────────────────────────────────────────────
  ngOnInit(): void {
    if (this.data) { this.reportData = this.data; this.loadData(); }
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (idRoot) {
      this.posicionesService.getPositionsByCompany(idRoot).subscribe({
        next: (r: any[]) => { this.posicionesValues = r.filter(p => p.active).map(p => p.description); },
        error: () => {},
      });
      this.onLoadCatalogs(idRoot);
    }
  }

  /** Sobrescribir para cargar catálogos extra (ej. materiales) */
  protected onLoadCatalogs(_idRoot: number): void {}

  /** Sobrescribir para remapear campos DB → frontend al leer */
  protected remapFromDb(item: any): any { return item; }

  // ── Carga de datos ───────────────────────────────────────────────────────
  protected loadData(): void {
    if (!this.reportData?.id) return;
    this.logbookService.getInfoByReporte(this.reportData.id, this.typeNoteValue).subscribe({
      next: (resp: any) => {
        this.rowData = resp.success
          ? (resp.data || []).map((item: any, i: number) => ({
              ...this.remapFromDb(item),
              id: item.id || `temp_${Date.now()}_${i}`,
              __isNew: false, __modified: false,
            }))
          : [];
        this.notifyParentCount(this.rowData.length);
      },
      error: () => (this.rowData = []),
    });
  }

  protected notifyParentCount(count: number): void {
    // 1. Actualiza la celda en el grid maestro
    if (this.context?.componentParent?.updateBitacoraCount) {
      this.context.componentParent.updateBitacoraCount(this.reportData?.id, this.bitacoraType, count);
    }
    // 2. Persiste el conteo en la tabla dailyreport
    if (this.reportData?.id) {
      this.dailyReportService.updateBitacoraCount(this.reportData.id, this.typeNoteValue, count)
        .subscribe({ error: (e: any) => console.error('Error persistiendo conteo:', e) });
    }
  }

  // ── Eventos de grid ──────────────────────────────────────────────────────
  onGridReady(params: GridReadyEvent): void { this.gridApi = params.api; }

  onCellValueChanged(event: any): void {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  onCellEditingStopped(event: any): void {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableCols.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableCols.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableCols[idx + 1] });
      }, 100);
    }
  }

  onCellDoubleClicked(event: any): void {
    console.log('Base onCellDoubleClicked fired:', event.colDef?.field);
  }

  onCellClicked(event: any): void {
    console.log('Base onCellClicked fired:', event.colDef?.field);
  }

  onSelectionChanged(event: any): void {
    console.log('Selection changed fired');
    const selectedRows = this.gridApi?.getSelectedRows();
    if (selectedRows && selectedRows.length > 0) {
      this.selectedRowData = selectedRows[0];
    } else {
      this.selectedRowData = null;
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  addRow(): void {
    const newRow = {
      id: `temp_${this.tempIdCounter++}`,
      idReporte: this.reportData?.id,
      date: new Date().toISOString().split('T')[0],
      active: true, __isNew: true, __modified: false,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: this.editableCols[0] });
    }, 50);
  }

  async saveChanges(): Promise<void> {
    this.gridApi?.stopEditing(); // commitear cualquier celda que esté en edición
    const newItems      = this.rowData.filter(r => r.__isNew);
    const modifiedItems = this.rowData.filter(r => r.__modified && !r.__isNew);
    if (!newItems.length && !modifiedItems.length) return;

    const err = this.validateRows([...newItems, ...modifiedItems]);
    if (err) { alerts.basicAlert('Campos requeridos', err, 'warning'); return; }

    try {
      for (const item of newItems) {
        await new Promise((res, rej) =>
          this.logbookService.addDataForOt(this.buildPayload(item)).subscribe({ next: res, error: rej }));
      }
      for (const item of modifiedItems) {
        await new Promise((res, rej) =>
          this.logbookService.updateDataForOt(item.id, this.buildPayload(item)).subscribe({ next: res, error: rej }));
      }
      alerts.basicAlert('Éxito', 'Guardado correctamente', 'success');
      this.hasUnsavedChanges = false;
      this.trackingService.addLog(
        this.trackingService.getCompany(),
        `Bitácora ${this.typeNoteValue}: ${newItems.length} guardado(s), ${modifiedItems.length} actualizado(s) — Reporte: ${this.reportData?.id}`,
        `Bitacora-${this.typeNoteValue}`,
        this.trackingService.getEmail()
      );
      this.loadData();
    } catch (e: any) {
      console.error('Error al guardar:', e);
      const errObj = e?.error?.errors ?? {};
      const msgs: string[] = (Object.values(errObj) as string[][]).flat();
      const msg = msgs.length ? msgs.join('\n') : (e?.error?.title || e?.message || 'Error desconocido');
      alerts.basicAlert('Error al guardar', msg, 'error');
    }
  }

  async deleteSelected(): Promise<void> {
    const rows = this.gridApi.getSelectedRows();
    if (!rows.length) { alerts.basicAlert('Aviso', 'Seleccione un registro', 'warning'); return; }
    const row = rows[0];
    if (row.__isNew) {
      this.rowData = this.rowData.filter(r => r !== row);
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = this.rowData.some(r => r.__isNew || r.__modified);
      this.notifyParentCount(this.rowData.length);
      return;
    }
    const result = await alerts.confirmAlert('¿Eliminar registro?', 'Esta acción no se puede deshacer', 'warning', 'Eliminar');
    if (!result.isConfirmed) return;
    this.logbookService.deleteDataForOt(row.id).subscribe({
      next: () => {
        this.trackingService.addLog(
          this.trackingService.getCompany(),
          `Bitácora ${this.typeNoteValue} eliminado ID: ${row.id} — Reporte: ${this.reportData?.id}`,
          `Bitacora-${this.typeNoteValue}`,
          this.trackingService.getEmail()
        );
        this.loadData();
      },
      error: (e: any) => {
        const msg = e?.error?.message || e?.error?.title || e?.message || 'No se pudo eliminar el registro';
        alerts.basicAlert('Error al eliminar', msg, 'error');
        console.error('Error eliminando ID:', row.id, e);
      },
    });
  }

  discardChanges(): void { this.loadData(); this.hasUnsavedChanges = false; }

  closeDetail(): void {
    if (this.context?.componentParent?.collapseBitacoraDetail) {
      this.context.componentParent.collapseBitacoraDetail(this.reportData?.id);
    }
  }

  // ── Utilidades ───────────────────────────────────────────────────────────
  protected validateRows(items: any[]): string | null {
    for (const item of items) {
      for (const { field, label } of this.requiredFields) {
        const v = item[field];
        if (v === null || v === undefined || v === '') return `Falta completar: ${label}`;
      }
    }
    return null;
  }

  protected toNum(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  protected basePayload(item: any): any {
    const idx = this.rowData.indexOf(item);
    return {
      idReporte: this.reportData?.id        ?? null,
      idProject: this.reportData?.idProject ?? null,
      typeNote:  this.typeNoteValue,
      date:      toIsoDate(item.date),
      orden:     idx >= 0 ? idx + 1 : 1,
      quantity:  this.toNum(item.quantity),
    };
  }
}
