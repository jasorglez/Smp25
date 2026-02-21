import { Component, Input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { LogbookService } from 'app/services/logbook.service';
import { PosicionesService } from 'app/services/posiciones.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

// Formatea cualquier valor de fecha → dd/MM/yyyy
const fmtDate = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const dateOnly = String(val).substring(0, 10); // toma solo yyyy-MM-dd
  const d = new Date(dateOnly + 'T00:00:00');
  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Convierte dd/MM/yyyy → yyyy-MM-dd (o deja ISO sin cambios)
const toIsoDate = (val: any): string => {
  if (!val) return new Date().toISOString().split('T')[0];
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  return new Date().toISOString().split('T')[0];
};

// Columna fecha: texto simple para que Enter funcione (display formateado)
const DATE_COL = (): ColDef => ({
  field: 'date',
  headerName: 'Fecha',
  width: 115,
  editable: true,
  valueFormatter: (p) => fmtDate(p.value),
  valueParser: (p) => toIsoDate(p.newValue),
  cellEditorParams: { useFormatter: true },
});

@Component({
  selector: 'app-bitacora-wrapper',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
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
        [columnDefs]="currentColumnDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        (cellEditingStopped)="onCellEditingStopped($event)"
        style="height: 300px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-grid-container { padding: 5px; background-color: #f8f9fa; border-radius: 4px; }
    .gap-1 { gap: 4px !important; }
  `]
})
export class BitacoraWrapperComponent implements OnInit, ICellRendererAngularComp {
  @Input() data: any;
  @Input() context: any;

  private logbookService    = inject(LogbookService);
  private posicionesService = inject(PosicionesService);
  private signalsService    = inject(SignalsService);
  private gridApi!: GridApi;

  rowData: any[]             = [];
  hasUnsavedChanges          = false;
  reportData: any            = null;
  tempIdCounter              = 0;
  bitacoraType               = 'personal';
  posicionesValues: string[] = [];
  private enterPressed       = false;

  // ── Enter-key: orden exacto de campos editables por tipo ─────────────────
  private editableColsMap: Record<string, string[]> = {
    personal:  ['date', 'position', 'quantity', 'start', 'end', 'description'],
    material:  ['date', 'idMaterial', 'name', 'quantity', 'unit', 'description'],
    equipos:   ['date', 'idEquipment', 'name', 'quantity', 'hours', 'description'],
    fotos:     ['date', 'description', 'url'],
    videos:    ['date', 'description', 'url'],
    conceptos: ['date', 'concept', 'quantity', 'unitPrice', 'total'],
    notas:     ['date', 'title', 'content'],
  };

  // ── Validación requerida por tipo ─────────────────────────────────────────
  private requiredFieldsMap: Record<string, { field: string; label: string }[]> = {
    personal:  [{ field: 'date', label: 'Fecha' }, { field: 'position', label: 'Puesto' }, { field: 'quantity', label: 'Cantidad' }],
    material:  [{ field: 'date', label: 'Fecha' }, { field: 'name',     label: 'Nombre' }, { field: 'quantity', label: 'Cantidad' }],
    equipos:   [{ field: 'date', label: 'Fecha' }, { field: 'name',     label: 'Nombre' }, { field: 'quantity', label: 'Cantidad' }],
    fotos:     [{ field: 'date', label: 'Fecha' }, { field: 'url',      label: 'URL' }],
    videos:    [{ field: 'date', label: 'Fecha' }, { field: 'url',      label: 'URL' }],
    conceptos: [{ field: 'date', label: 'Fecha' }, { field: 'concept',  label: 'Concepto' }, { field: 'quantity', label: 'Cantidad' }, { field: 'unitPrice', label: 'Precio Unit.' }, { field: 'total', label: 'Total' }],
    notas:     [{ field: 'date', label: 'Fecha' }, { field: 'title',    label: 'Título'   }, { field: 'content',  label: 'Contenido' }],
  };

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    },
  };

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    rowSelection: 'single',
    rowClassRules: {
      'new-row-highlight': (params: any) => !!params.data?.__isNew,
    },
  };

  private typeNoteMap: Record<string, string> = {
    personal:  'PERSONAL',
    material:  'MATERIAL',
    equipos:   'EQUIPMENT',
    fotos:     'Photo',
    videos:    'Video',
    conceptos: 'CONCEPT',
    notas:     'NOTE',
  };

  // ── Definición de columnas por tipo ───────────────────────────────────────
  private columnDefsMap: Record<string, ColDef[]> = {
    personal: [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      DATE_COL(),
      {
        field: 'position', headerName: 'Puesto', editable: true, width: 160,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.posicionesValues }),
        valueFormatter: (p) => p.value || '',
      },
      { field: 'quantity',    headerName: 'Cantidad',    editable: true, width: 90,  type: 'numericColumn' },
      { field: 'start',       headerName: 'Inicio',      editable: true, width: 90  },
      { field: 'end',         headerName: 'Término',     editable: true, width: 90  },
      { field: 'description', headerName: 'Descripción', editable: true, flex: 1    },
    ],
    material: [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      DATE_COL(),
      { field: 'idMaterial',  headerName: 'ID Material', editable: true, width: 110 },
      { field: 'name',        headerName: 'Nombre',      editable: true, flex: 1    },
      { field: 'quantity',    headerName: 'Cantidad',    editable: true, width: 90,  type: 'numericColumn' },
      { field: 'unit',        headerName: 'Unidad',      editable: true, width: 80  },
      { field: 'description', headerName: 'Descripción', editable: true, width: 180 },
    ],
    equipos: [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      DATE_COL(),
      { field: 'idEquipment', headerName: 'ID Equipo',   editable: true, width: 110 },
      { field: 'name',        headerName: 'Nombre',      editable: true, flex: 1    },
      { field: 'quantity',    headerName: 'Cantidad',    editable: true, width: 90,  type: 'numericColumn' },
      { field: 'hours',       headerName: 'Horas',       editable: true, width: 80  },
      { field: 'description', headerName: 'Descripción', editable: true, width: 180 },
    ],
    fotos: [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      DATE_COL(),
      { field: 'description', headerName: 'Descripción', editable: true, flex: 1    },
      { field: 'url',         headerName: 'URL',         editable: true, width: 220 },
    ],
    videos: [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      DATE_COL(),
      { field: 'description', headerName: 'Descripción', editable: true, flex: 1    },
      { field: 'url',         headerName: 'URL',         editable: true, width: 220 },
    ],
    conceptos: [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      DATE_COL(),
      { field: 'concept',   headerName: 'Concepto',     editable: true, flex: 1  },
      { field: 'quantity',  headerName: 'Cantidad',     editable: true, width: 90,  type: 'numericColumn' },
      { field: 'unitPrice', headerName: 'Precio Unit.', editable: true, width: 120, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value) : '' },
      { field: 'total',     headerName: 'Total',        editable: true, width: 120, type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value) : '' },
    ],
    notas: [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      DATE_COL(),
      { field: 'title',   headerName: 'Título',    editable: true, width: 200 },
      { field: 'content', headerName: 'Contenido', editable: true, flex: 1   },
    ],
  };

  get currentColumnDefs(): ColDef[] {
    return this.columnDefsMap[this.bitacoraType] || this.columnDefsMap['personal'];
  }

  private get editableCols(): string[] {
    return this.editableColsMap[this.bitacoraType] || this.editableColsMap['personal'];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  agInit(params: ICellRendererParams): void {
    this.data    = params.data;
    this.context = params.context;
  }

  refresh(params: ICellRendererParams): boolean {
    this.data = params.data;
    return true;
  }

  ngOnInit(): void {
    if (this.data) {
      this.reportData   = this.data;
      this.bitacoraType = this.data.detailType || 'personal';
      this.loadData();
    }
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (idRoot) {
      this.posicionesService.getPositionsByCompany(idRoot).subscribe({
        next: (resp: any[]) => {
          this.posicionesValues = resp.filter(p => p.active).map(p => p.description);
        },
        error: () => {},
      });
    }
  }

  // ── Grid events ───────────────────────────────────────────────────────────

  onGridReady(params: GridReadyEvent) { this.gridApi = params.api; }

  onCellValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const cols = this.editableCols;
    const idx  = cols.indexOf(event.column.getColId());
    if (idx !== -1 && idx < cols.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: cols[idx + 1] });
      }, 100);
    }
  }

  // ── Data ─────────────────────────────────────────────────────────────────

  private loadData() {
    if (!this.reportData?.id) return;
    const typeNote = this.typeNoteMap[this.bitacoraType] || 'PERSONAL';
    this.logbookService.getInfoByReporte(this.reportData.id, typeNote).subscribe({
      next: (resp: any) => {
        this.rowData = resp.success
          ? (resp.data || []).map((item: any, i: number) => ({
              ...item,
              id: item.id || `temp_${Date.now()}_${i}`,
              __isNew: false, __modified: false,
            }))
          : [];
        this.notifyParentCount(this.rowData.length);
      },
      error: () => (this.rowData = []),
    });
  }

  private notifyParentCount(count: number) {
    if (this.context?.componentParent?.updateBitacoraCount) {
      this.context.componentParent.updateBitacoraCount(
        this.reportData?.id, this.bitacoraType, count
      );
    }
  }

  addRow() {
    const newRow = {
      id:         `temp_${this.tempIdCounter++}`,
      idReporte:  this.reportData?.id,
      date:       new Date().toISOString().split('T')[0],
      active:     true,
      __isNew:    true,
      __modified: false,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: this.editableCols[0] });
    }, 50);
  }

  // ── Validación ───────────────────────────────────────────────────────────

  private validateRows(items: any[]): string | null {
    const required = this.requiredFieldsMap[this.bitacoraType] || [];
    for (const item of items) {
      for (const { field, label } of required) {
        const val = item[field];
        if (val === null || val === undefined || val === '') {
          return `Falta completar: <b>${label}</b>`;
        }
      }
    }
    return null;
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async saveChanges() {
    const newItems      = this.rowData.filter(r => r.__isNew);
    const modifiedItems = this.rowData.filter(r => r.__modified && !r.__isNew);
    if (!newItems.length && !modifiedItems.length) return;

    const error = this.validateRows([...newItems, ...modifiedItems]);
    if (error) {
      alerts.basicAlert('Campos requeridos', error, 'warning');
      return;
    }

    try {
      for (const item of newItems) {
        await new Promise((resolve, reject) => {
          this.logbookService.addDataForOt(this.buildPayload(item))
            .subscribe({ next: resolve, error: reject });
        });
      }
      for (const item of modifiedItems) {
        await new Promise((resolve, reject) => {
          this.logbookService.updateDataForOt(item.id, this.buildPayload(item))
            .subscribe({ next: resolve, error: reject });
        });
      }
      alerts.basicAlert('Éxito', 'Guardado correctamente', 'success');
      this.hasUnsavedChanges = false;
      this.loadData();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Error desconocido';
      alerts.basicAlert('Error al guardar', msg, 'error');
    }
  }

  private buildPayload(item: any): any {
    const typeNote = this.typeNoteMap[this.bitacoraType] || 'PERSONAL';
    const idx      = this.rowData.indexOf(item);
    const orden    = idx >= 0 ? idx + 1 : 1;
    return {
      idReporte:   this.reportData?.id        ?? null,
      idProject:   this.reportData?.idProject ?? null,
      typeNote,
      date:        toIsoDate(item.date),
      description: item.description || ' ',
      orden,
      position:    item.position    ?? null,
      quantity:    item.quantity    ?? null,
      start:       item.start       ?? null,
      end:         item.end         ?? null,
      idMaterial:  item.idMaterial  ?? null,
      name:        item.name        ?? null,
      unit:        item.unit        ?? null,
      idEquipment: item.idEquipment ?? null,
      hours:       item.hours       ?? null,
      url:         item.url         ?? null,
      concept:     item.concept     ?? null,
      unitPrice:   item.unitPrice   ?? null,
      total:       item.total       ?? null,
      title:       item.title       ?? null,
      content:     item.content     ?? null,
    };
  }

  async deleteSelected() {
    const rows = this.gridApi.getSelectedRows();
    if (!rows.length) {
      alerts.basicAlert('Aviso', 'Seleccione un registro', 'warning');
      return;
    }
    const row = rows[0];
    if (row.__isNew) {
      this.rowData = this.rowData.filter(r => r !== row);
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = this.rowData.some(r => r.__isNew || r.__modified);
      this.notifyParentCount(this.rowData.length);
      return;
    }
    const result = await alerts.confirmAlert(
      '¿Eliminar registro?', 'Esta acción no se puede deshacer', 'warning', 'Eliminar'
    );
    if (!result.isConfirmed) return;
    this.logbookService.deleteDataForOt(row.id).subscribe({
      next: () => this.loadData(),
      error: () => alerts.basicAlert('Error', 'No se pudo eliminar', 'error'),
    });
  }

  discardChanges() {
    this.loadData();
    this.hasUnsavedChanges = false;
  }

  closeDetail() {
    if (this.context?.componentParent?.collapseBitacoraDetail) {
      this.context.componentParent.collapseBitacoraDetail(this.reportData?.id);
    }
  }
}
