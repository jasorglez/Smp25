import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { MoliendaService, DetailsMolienda } from '../../../../../services/molienda.service';
import { CatalogsService } from '../../../../../services/catalogs.service';
import { SignalsService } from '../../../../../services/signals.service';
import { Icatalog } from '../../../../../interface/icatalog';
import { SelectWithTooltipEditorV2Component } from '../../../../../shared/select-with-tooltip-editor-v2.component';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detalle-molienda',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;"
         [style.backgroundColor]="detailType === 'entradas' ? '#e8f5e9' : '#fce4ec'">

      <div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <strong style="font-size: 0.85rem;">{{ detailType === 'entradas' ? 'Entradas' : 'Salidas' }}</strong>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-success" (click)="addRow()" title="Agregar">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button class="btn btn-sm btn-primary position-relative" (click)="saveChanges()" [disabled]="!hasUnsavedChanges" title="Guardar">
            <i class="bi bi-floppy"></i>
            <span *ngIf="hasUnsavedChanges"
                  class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
            </span>
          </button>
          <button class="btn btn-sm btn-warning" (click)="revertChanges()" title="Deshacer">
            <i class="bi bi-arrow-counterclockwise"></i>
          </button>
          <button class="btn btn-sm btn-danger" (click)="deleteRow()" [disabled]="!selectedRow" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (rowClicked)="onRowClicked($event)"
          (cellValueChanged)="onCellValueChanged($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`]
})
export class DetalleMoliendaComponent {
  private moliendaService = inject(MoliendaService);
  private catalogsService = inject(CatalogsService);
  private signalsService = inject(SignalsService);

  private internalParams: any;
  private gridApi!: GridApi;

  private readonly NEW_CATALOG = '__NEW_CATALOG__';

  detailType: 'entradas' | 'salidas' = 'entradas';
  rowData: any[] = [];
  private originalRowData: any[] = [];
  hasUnsavedChanges = false;
  selectedRow: any = null;
  private catalogOptions: Icatalog[] = [];
  private currentEditingNode: any = null;

  get fechaField() { return this.detailType === 'entradas' ? 'fechaEntrada' : 'fechaSalida'; }
  get fechaHeader() { return this.detailType === 'entradas' ? 'Fecha Entrada' : 'Fecha Salida'; }

  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 50,
      valueGetter: (p) => p.node.rowIndex + 1,
      cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
    },
    {
      field: 'folio',
      headerName: 'Folio',
      width: 160,
      editable: true,
      cellDataType: 'String',
      cellEditor: 'agStringCellEditor',
      valueFormatter: (p) => {
        if (!p.value) return '';
        const d = p.value instanceof Date ? p.value : new Date(p.value);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      },
      valueSetter: (p) => {
        if (!p.newValue) return false;
        p.data.fecha = p.newValue instanceof Date ? p.newValue : new Date(p.newValue);
        p.data.__modified = true;
        this.hasUnsavedChanges = true;
        return true;
      }
    },
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 160,
      editable: true,
      cellDataType: 'date',
      cellEditor: 'agDateCellEditor',
      valueFormatter: (p) => {
        if (!p.value) return '';
        const d = p.value instanceof Date ? p.value : new Date(p.value);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      },
      valueSetter: (p) => {
        if (!p.newValue) return false;
        p.data.fecha = p.newValue instanceof Date ? p.newValue : new Date(p.newValue);
        p.data.__modified = true;
        this.hasUnsavedChanges = true;
        return true;
      }
    },
    {
      field: 'idCatalog',
      headerName: 'Tipo',
      minWidth: 160,
      editable: true,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: () => ({
        options: [
          ...this.catalogOptions.map(c => ({ id: c.id, description: c.description })),
          { id: this.NEW_CATALOG, description: '➕ Nuevo tipo' }
        ],
        specialValues: [this.NEW_CATALOG],
        onSpecialValue: (_value: any, params: any) => {
          this.currentEditingNode = params.node;
          this.addNewCatalog();
        }
      }),
      valueFormatter: (p) => this.catalogOptions.find(c => c.id === p.value)?.description ?? '',
      valueSetter: (p) => {
        if (p.newValue === this.NEW_CATALOG) return false;
        p.data.idCatalog = p.newValue ?? null;
        p.data.__modified = true;
        this.hasUnsavedChanges = true;
        return true;
      }
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      minWidth: 120,
      editable: true,
      type: 'numericColumn',
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0, precision: 2 },
      valueSetter: (p) => {
        p.data.cantidad = p.newValue ?? 0;
        p.data.__modified = true;
        this.hasUnsavedChanges = true;
        return true;
      }
    }
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    defaultColDef: { resizable: true, sortable: true }
  };

  agInit(params: any) {
    this.init(params);
  }

  refresh(params: any): boolean {
    this.internalParams = params;
    return true;
  }

  private init(params: any) {
    this.internalParams = params;
    this.detailType = params?.data?.detailType ?? 'entradas';
    // Actualizar headerName de fecha dinámica
    const fechaCol = this.colDefs.find(c => (c as any).field === 'fecha');
    if (fechaCol) fechaCol.headerName = this.fechaHeader;
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('columnDefs', [...this.colDefs]);
      this.loadData();
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.loadData();
  }

  async loadData() {
    const idMolienda = this.internalParams?.data?.id;
    const idRoot = this.signalsService.getRootSelectedBySidebar()();

    if (idRoot) {
      const catalogType = this.detailType === 'entradas' ? 'TYPEENTRY' : 'TYPEOUT';
      try {
        this.catalogOptions = await lastValueFrom(this.catalogsService.getCatalogs(idRoot, catalogType));
      } catch { this.catalogOptions = []; }
    }

    if (!idMolienda || typeof idMolienda === 'string') {
      this.rowData = [];
      this.originalRowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', []);
      return;
    }

    try {
      const type = this.detailType === 'entradas' ? 'ENTRADA' : 'SALIDA';
      const items = await lastValueFrom(this.moliendaService.getDetails(idMolienda, type));
      this.rowData = (Array.isArray(items) ? items : []).map(d => ({
        id: d.id,
        fecha: d.fecha ? new Date(d.fecha as string) : null,
        cantidad: d.cantidad ?? 0,
        idCatalog: d.idCatalog ?? null,
        __isNew: false, __modified: false,
      }));
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.updateParentCount();
    } catch (error) {
      console.error('Error loading details molienda:', error);
    }
  }

  onRowClicked(event: any) { this.selectedRow = event.data; }

  onCellValueChanged(event: any) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  }

  addRow() {
    const today = new Date();
    const newRow = {
      id: null,
      fecha: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      cantidad: 0,
      idCatalog: null,
      __isNew: true
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'fecha' });
      }, 0);
    }
  }

  async saveChanges() {
    const idMolienda = this.internalParams?.data?.id;
    if (!idMolienda || typeof idMolienda === 'string') {
      alerts.basicAlert('Error', 'Guarda el registro principal antes de agregar detalles.', 'warning');
      return;
    }

    const type = this.detailType === 'entradas' ? 'ENTRADA' : 'SALIDA';
    const newRows = this.rowData.filter(r => r.__isNew);
    const modifiedRows = this.rowData.filter(r => r.__modified && !r.__isNew);
    if (newRows.length === 0 && modifiedRows.length === 0) return;

    // Validar stock disponible para salidas
    if (this.detailType === 'salidas') {
      const rowsToValidate = [...newRows, ...modifiedRows];
      const error = await this.validateSalidas(idMolienda, rowsToValidate);
      if (error) {
        alerts.basicAlert('Stock insuficiente', error, 'warning');
        return;
      }
    }

    try {
      for (const row of newRows) {
        const payload: DetailsMolienda = {
          idMolienda,
          type,
          fecha: row.fecha instanceof Date ? row.fecha.toISOString().substring(0, 10) : (row.fecha ?? null),
          cantidad: row.cantidad ?? 0,
          idCatalog: row.idCatalog ?? null,
        };
        const created = await lastValueFrom(this.moliendaService.createDetail(payload));
        row.id = created.id;
        row.__isNew = false;
      }
      for (const row of modifiedRows) {
        const payload: DetailsMolienda = {
          idMolienda,
          type,
          fecha: row.fecha instanceof Date ? row.fecha.toISOString().substring(0, 10) : (row.fecha ?? null),
          cantidad: row.cantidad ?? 0,
          idCatalog: row.idCatalog ?? null,
        };
        await lastValueFrom(this.moliendaService.updateDetail(row.id, payload));
        row.__modified = false;
      }

      this.hasUnsavedChanges = false;
      this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
      if (this.gridApi) this.gridApi.setGridOption('rowData', [...this.rowData]);
      this.updateParentCount();
    } catch (error) {
      console.error('Error saving details:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar.', 'error');
    }
  }

  revertChanges() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.hasUnsavedChanges = false;
    this.selectedRow = null;
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
  }

  async deleteRow() {
    if (!this.selectedRow) return;

    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.selectedRow = null;
      this.hasUnsavedChanges = this.rowData.some(r => r.__isNew || r.__modified);
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      return;
    }

    const confirm = await alerts.confirmAlert('¿Eliminar?', '', 'warning', 'Sí, eliminar');
    if (!confirm.isConfirmed) return;

    try {
      await lastValueFrom(this.moliendaService.deleteDetail(this.selectedRow.id));
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.originalRowData = this.originalRowData.filter(r => r.id !== this.selectedRow.id);
      this.selectedRow = null;
      this.updateParentCount();
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
    } catch (error) {
      console.error('Error deleting detail:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al eliminar.', 'error');
    }
  }

  private async validateSalidas(idMolienda: number, rowsToSave: any[]): Promise<string | null> {
    const [entradasDB, salidasDB] = await Promise.all([
      lastValueFrom(this.moliendaService.getDetails(idMolienda, 'ENTRADA')),
      lastValueFrom(this.moliendaService.getDetails(idMolienda, 'SALIDA')),
    ]);

    // Salidas ya guardadas en DB (sin las que estamos por guardar ahora)
    const savedIds = new Set(rowsToSave.map(r => r.id).filter(Boolean));
    const salidasBase = salidasDB.filter(s => !savedIds.has(s.id));

    // Validar cada fila a guardar en orden de fecha
    const sorted = [...rowsToSave].sort((a, b) => {
      const fa = a.fecha instanceof Date ? a.fecha : new Date(a.fecha);
      const fb = b.fecha instanceof Date ? b.fecha : new Date(b.fecha);
      return fa.getTime() - fb.getTime();
    });

    // Acumular las nuevas salidas ya validadas en esta misma sesión
    const pendingSalidas: { fecha: Date; cantidad: number }[] = [];

    for (const row of sorted) {
      const fecha = row.fecha instanceof Date ? row.fecha : new Date(row.fecha);
      const cantidad = Number(row.cantidad) || 0;

      const sumEntradas = entradasDB
        .filter(e => e.fecha && new Date(e.fecha as string) <= fecha)
        .reduce((acc, e) => acc + (Number(e.cantidad) || 0), 0);

      const sumSalidasDB = salidasBase
        .filter(s => s.fecha && new Date(s.fecha as string) <= fecha)
        .reduce((acc, s) => acc + (Number(s.cantidad) || 0), 0);

      const sumPending = pendingSalidas
        .filter(p => p.fecha <= fecha)
        .reduce((acc, p) => acc + p.cantidad, 0);

      const disponible = sumEntradas - sumSalidasDB - sumPending;

      if (cantidad > disponible) {
        const fechaStr = fecha.toLocaleDateString('es-MX');
        return `Al ${fechaStr}, el stock disponible es <b>${disponible.toFixed(2)}</b> y se solicitaron <b>${cantidad.toFixed(2)}</b>.`;
      }

      pendingSalidas.push({ fecha, cantidad });
    }

    return null;
  }

  private async addNewCatalog() {
    const result = await alerts.inputAlert('Nuevo tipo', 'Ingresa el nombre', 'text');
    if (!result.isConfirmed || !result.value?.trim()) return;

    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (!idRoot) return;

    const catalogType = this.detailType === 'entradas' ? 'TYPEENTRY' : 'TYPEOUT';
    try {
      const created = await lastValueFrom(this.catalogsService.addCatalog({
        idCompany: idRoot,
        description: result.value.trim(),
        type: catalogType,
        active: 1
      }));
      this.catalogOptions = await lastValueFrom(this.catalogsService.getCatalogs(idRoot, catalogType));
      if (this.currentEditingNode && created?.id) {
        this.currentEditingNode.setDataValue('idCatalog', created.id);
        this.currentEditingNode.data.__modified = true;
        this.hasUnsavedChanges = true;
      }
    } catch {
      alerts.basicAlert('Error', 'No se pudo crear el tipo.', 'error');
    }
  }

  private updateParentCount() {
    if (!this.internalParams?.node) return;
    const data = this.internalParams.node.data;

    const countField = this.detailType === 'entradas' ? 'entradas' : 'salidas';
    data[countField] = this.rowData.length;

    const sumThis = this.rowData.reduce((acc, r) => acc + (Number(r.cantidad) || 0), 0);
    if (this.detailType === 'entradas') {
      data.totalEntradas = sumThis;
      data.totalInventarios = sumThis - (data.totalSalidas ?? 0);
    } else {
      data.totalSalidas = sumThis;
      data.totalInventarios = (data.totalEntradas ?? 0) - sumThis;
    }

    if (this.internalParams.api) {
      this.internalParams.api.refreshCells({
        rowNodes: [this.internalParams.node],
        columns: [countField, 'totalEntradas', 'totalSalidas', 'totalInventarios'],
        force: true
      });
    }
  }
}
