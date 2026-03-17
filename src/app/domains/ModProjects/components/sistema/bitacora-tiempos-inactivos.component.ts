import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import Swal from 'sweetalert2';

import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES } from './bitacora-base.component';
import { TimeInactiveService } from 'app/services/time-inactive.service';
import { CatalogsService }     from 'app/services/catalogs.service';
import { alerts }              from 'app/helpers/alerts';

@Component({
  selector: 'app-bitacora-tiempos-inactivos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: BITACORA_TEMPLATE,
  styles: BITACORA_STYLES,
})
export class BitacoraTimesInactivosComponent extends BitacoraBaseComponent {

  // ── Abstract members ────────────────────────────────────────────────────────
  readonly bitacoraType   = 'tiempos';
  readonly typeNoteValue  = 'TIME_INACTIVE';
  readonly editableCols   = ['idArea', 'idClasification', 'timeStart', 'timeEnd', 'personal', 'cause'];
  readonly requiredFields = [
    { field: 'idArea',     label: 'Área'    },
    { field: 'timeStart',  label: 'Inicio'  },
    { field: 'timeEnd',    label: 'Término' },
  ];

  // ── Servicios propios ────────────────────────────────────────────────────────
  private timeInactiveService = inject(TimeInactiveService);
  private catalogsService     = inject(CatalogsService);

  // ── Catálogos ────────────────────────────────────────────────────────────────
  areasCatalog:           any[] = [];
  clasificacionesCatalog: any[] = [];
  private idRoot = 0;

  // ── Columnas ─────────────────────────────────────────────────────────────────
  get colDefs(): ColDef[] {
    return [
      {
        headerName: '#', width: 45, pinned: 'left', editable: false,
        valueGetter: (p) => p.node!.rowIndex! + 1,
      },
      {
        field: 'idArea', headerName: 'Área', editable: true, width: 200,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: [...this.areasCatalog.map((a: any) => a.description), '➕ Nueva área...'],
        }),
        valueGetter: (p) => {
          const area = this.areasCatalog.find((a: any) => a.id === p.data?.idArea);
          return area?.description || '';
        },
        valueSetter: (p) => {
          if (p.newValue === '➕ Nueva área...') {
            this.addNewCatalogEntry('AREAS', p);
            return false;
          }
          const area = this.areasCatalog.find((a: any) => a.description === p.newValue);
          p.data.idArea = area?.id ?? null;
          return true;
        },
      },
      {
        field: 'idClasification', headerName: 'Clasificación', editable: true, width: 180,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: [...this.clasificacionesCatalog.map((c: any) => c.description), '➕ Nueva clasificación...'],
        }),
        valueGetter: (p) => {
          const cls = this.clasificacionesCatalog.find((c: any) => c.id === p.data?.idClasification);
          return cls?.description || '';
        },
        valueSetter: (p) => {
          if (p.newValue === '➕ Nueva clasificación...') {
            this.addNewCatalogEntry('TIME_CLASIF', p);
            return false;
          }
          const cls = this.clasificacionesCatalog.find((c: any) => c.description === p.newValue);
          p.data.idClasification = cls?.id ?? null;
          return true;
        },
      },
      {
        field: 'timeStart', headerName: 'Inicio', editable: true, width: 90,
        valueFormatter: (p) => p.value || '',
      },
      {
        field: 'timeEnd', headerName: 'Término', editable: true, width: 90,
        valueFormatter: (p) => p.value || '',
      },
      {
        field: 'personal', headerName: 'Personal afect.', editable: true, width: 120,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
      },
      {
        field: 'cause', headerName: 'Causa', editable: true, minWidth: 200, flex: 1,
        cellEditor: 'agTextCellEditor',
      },
      {
        field: 'total', headerName: 'HH Inactivas', editable: false, width: 115,
        valueGetter: (p) => this.calcTotal(p.data),
        valueFormatter: (p) => p.value != null ? `${p.value} hh` : '—',
        cellStyle: { color: '#c0392b', fontWeight: 'bold', textAlign: 'right' },
      },
    ];
  }

  // ── Cargar catálogos ─────────────────────────────────────────────────────────
  protected override onLoadCatalogs(idRoot: number): void {
    this.idRoot = idRoot;
    this.catalogsService.getTypeEquipment(idRoot, 'AREAS').subscribe({
      next: (data: any[]) => {
        this.areasCatalog = data;
        this.gridApi?.refreshCells({ force: true });
      },
    });
    this.catalogsService.getTypeEquipment(idRoot, 'TIME_CLASIF').subscribe({
      next: (data: any[]) => {
        this.clasificacionesCatalog = data;
        this.gridApi?.refreshCells({ force: true });
      },
    });
  }

  // ── Cargar datos ─────────────────────────────────────────────────────────────
  protected override loadData(): void {
    if (!this.reportData?.id) return;
    this.timeInactiveService.getByReporte(this.reportData.id).subscribe({
      next: (data: any[]) => {
        this.rowData = (Array.isArray(data) ? data : []).map((item: any) => ({
          ...item,
          timeStart: item.timeStart ? String(item.timeStart).substring(0, 5) : '',
          timeEnd:   item.timeEnd   ? String(item.timeEnd).substring(0, 5)   : '',
          __isNew: false, __modified: false,
        }));
        this.notifyParentCount(this.rowData.length);
      },
      error: () => (this.rowData = []),
    });
  }

  // ── Fila nueva ───────────────────────────────────────────────────────────────
  override addRow(): void {
    const reportDate = this.reportData?.date
      ? String(this.reportData.date).substring(0, 10)
      : new Date().toISOString().split('T')[0];
    const newRow = {
      id:              `temp_${this.tempIdCounter++}`,
      idReporte:       this.reportData?.id,
      idProject:       this.reportData?.idProject,
      date:            reportDate,
      idArea:          null,
      idClasification: null,
      timeStart:       '08:00',
      timeEnd:         '09:00',
      personal:        0,
      cause:           '',
      total:           0,
      active:          true,
      __isNew: true, __modified: false,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: this.editableCols[0] });
    }, 50);
  }

  // ── Refresh total al editar campos que lo afectan ────────────────────────────
  override onCellValueChanged(event: any): void {
    super.onCellValueChanged(event);
    if (['personal', 'timeStart', 'timeEnd'].includes(event.column.getColId())) {
      this.gridApi?.refreshCells({ rowNodes: [event.node], columns: ['total'], force: true });
    }
  }

  // ── Guardar ──────────────────────────────────────────────────────────────────
  override async saveChanges(): Promise<void> {
    this.gridApi?.stopEditing();
    const newItems      = this.rowData.filter(r => r.__isNew);
    const modifiedItems = this.rowData.filter(r => r.__modified && !r.__isNew);
    if (!newItems.length && !modifiedItems.length) return;

    const err = this.validateRows([...newItems, ...modifiedItems]);
    if (err) { alerts.basicAlert('Campos requeridos', err, 'warning'); return; }

    try {
      for (const item of newItems) {
        await new Promise((res, rej) =>
          this.timeInactiveService.add(this.buildPayload(item)).subscribe({ next: res, error: rej }));
      }
      for (const item of modifiedItems) {
        await new Promise((res, rej) =>
          this.timeInactiveService.update(item.id, { ...this.buildPayload(item), id: item.id })
            .subscribe({ next: res, error: rej }));
      }
      alerts.basicAlert('Éxito', 'Guardado correctamente', 'success');
      this.hasUnsavedChanges = false;
      this.loadData();
    } catch (e: any) {
      const msg = e?.error?.title || e?.message || 'Error desconocido';
      alerts.basicAlert('Error al guardar', msg, 'error');
    }
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────────
  override async deleteSelected(): Promise<void> {
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
    const result = await alerts.confirmAlert('¿Eliminar?', 'Esta acción no se puede deshacer', 'warning', 'Eliminar');
    if (!result.isConfirmed) return;
    this.timeInactiveService.delete(row.id).subscribe({
      next: () => { alerts.basicAlert('Eliminado', 'Registro eliminado', 'success'); this.loadData(); },
      error: () => alerts.basicAlert('Error', 'No se pudo eliminar', 'error'),
    });
  }

  // ── buildPayload ─────────────────────────────────────────────────────────────
  buildPayload(item: any): any {
    return {
      idReporte:       this.reportData?.id        ?? null,
      idProject:       this.reportData?.idProject ?? null,
      date:            this.reportData?.date ? String(this.reportData.date).substring(0, 10) : new Date().toISOString().split('T')[0],
      idArea:          item.idArea          ?? null,
      idClasification: item.idClasification ?? null,
      timeStart:       this.toTimeSpan(item.timeStart),
      timeEnd:         this.toTimeSpan(item.timeEnd),
      personal:        item.personal  ?? 0,
      cause:           item.cause?.trim() || null,
      total:           this.calcTotal(item),
      idProgram:       null,
      active:          true,
    };
  }

  /** Convierte "HH:mm" → "HH:mm:ss" para que C# TimeSpan pueda deserializarlo */
  private toTimeSpan(val: string | null | undefined): string | null {
    if (!val) return null;
    const s = String(val).trim();
    return /^\d{2}:\d{2}$/.test(s) ? s + ':00' : s;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  private calcTotal(data: any): number {
    if (!data?.timeStart || !data?.timeEnd) return 0;
    const [sh, sm] = String(data.timeStart).split(':').map(Number);
    const [eh, em] = String(data.timeEnd).split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return 0;
    return Number(((mins / 60) * (data.personal || 1)).toFixed(2));
  }

  private async addNewCatalogEntry(type: 'AREAS' | 'TIME_CLASIF', params: any): Promise<void> {
    const label = type === 'AREAS' ? 'Área' : 'Clasificación';
    const { value: description } = await Swal.fire({
      title: `Nueva ${label}`,
      input: 'text',
      inputPlaceholder: `Nombre de la ${label.toLowerCase()}...`,
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      inputValidator: (v) => !v ? 'Escribe un nombre' : null,
    });
    if (!description) return;

    const catalog = { idCompany: this.idRoot, description, type, active: 1 };
    this.catalogsService.addCatalogToSmp(catalog).subscribe({
      next: () => {
        this.catalogsService.getTypeEquipment(this.idRoot, type).subscribe({
          next: (data: any[]) => {
            if (type === 'AREAS') this.areasCatalog = data;
            else this.clasificacionesCatalog = data;
            // Asignar el nuevo id a la fila
            const newEntry = data.find((d: any) => d.description === description);
            if (newEntry && params.node) {
              if (type === 'AREAS') params.node.data.idArea = newEntry.id;
              else params.node.data.idClasification = newEntry.id;
              params.node.data.__modified = !params.node.data.__isNew;
              this.hasUnsavedChanges = true;
              this.gridApi.refreshCells({ rowNodes: [params.node], force: true });
            }
          },
        });
      },
      error: () => alerts.basicAlert('Error', `No se pudo agregar la ${label.toLowerCase()}`, 'error'),
    });
  }
}
