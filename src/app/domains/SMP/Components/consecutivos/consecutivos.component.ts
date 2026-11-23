import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { SignalsService } from 'app/services/signals.service';
import { ConsecutivoConfig, ConsecutivosService } from 'app/services/consecutivos.service';

@Component({
  selector: 'app-consecutivos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './consecutivos.component.html',
  styleUrl: './consecutivos.component.scss',
})
export class ConsecutivosComponent implements CanComponentDeactivate {
  private service = inject(ConsecutivosService);
  private signals = inject(SignalsService);

  idRoot = 0;
  rowData: ConsecutivoConfig[] = [];
  selected: ConsecutivoConfig | null = null;
  hasUnsavedChanges = false;
  private gridApi!: GridApi<ConsecutivoConfig>;
  private nextTempId = -1;

  defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1 };
  columnDefs: ColDef<ConsecutivoConfig>[] = [
    { field: 'consecutivoTexto', headerName: 'Consecutivo / prefijo', editable: true, minWidth: 230 },
    { field: 'campoAuxiliar', headerName: 'Siguiente número', editable: true, minWidth: 180, cellDataType: 'number' },
    {
      headerName: 'Vista previa', minWidth: 180, editable: false,
      valueGetter: p => `${p.data?.consecutivoTexto || ''}${p.data?.campoAuxiliar ?? ''}`,
    },
  ];

  constructor() {
    effect(() => {
      const root = Number(this.signals.getRootSelectedBySidebar()() || localStorage.getItem('company') || 0);
      if (root !== this.idRoot) {
        this.idRoot = root;
        this.load();
      }
    });
  }

  onGridReady(event: GridReadyEvent<ConsecutivoConfig>): void { this.gridApi = event.api; }

  load(): void {
    if (!this.idRoot) { this.rowData = []; return; }
    this.service.getByRoot(this.idRoot).subscribe({
      next: rows => { this.rowData = rows; this.hasUnsavedChanges = false; },
      error: error => { console.error('Error al cargar consecutivos', error); alerts.basicAlert('Error', 'No se pudieron cargar los consecutivos.', 'error'); },
    });
  }

  add(): void {
    if (!this.idRoot) { alerts.basicAlert('Empresa', 'Selecciona una empresa antes de agregar un consecutivo.', 'warning'); return; }
    const item: ConsecutivoConfig = { id: this.nextTempId--, idRoot: this.idRoot, consecutivoTexto: '', campoAuxiliar: 1, __isNew: true };
    this.rowData = [...this.rowData, item];
    this.hasUnsavedChanges = true;
    this.gridApi?.setGridOption('rowData', this.rowData);
    requestAnimationFrame(() => {
      const index = this.rowData.length - 1;
      this.gridApi?.setFocusedCell(index, 'consecutivoTexto');
      this.gridApi?.startEditingCell({ rowIndex: index, colKey: 'consecutivoTexto' });
    });
  }

  onSelectionChanged(): void { this.selected = this.gridApi?.getSelectedNodes()[0]?.data || null; }

  onCellValueChanged(event: any): void {
    const row = event.data as ConsecutivoConfig;
    if (!row.__isNew) row.__modified = true;
    this.hasUnsavedChanges = true;
    event.api.refreshCells({ rowNodes: [event.node], force: true });
  }

  async save(): Promise<void> {
    const invalid = this.rowData.find(x => !x.consecutivoTexto?.trim() || !Number.isInteger(Number(x.campoAuxiliar)) || Number(x.campoAuxiliar) < 1);
    if (invalid) { alerts.basicAlert('Datos incompletos', 'Captura el prefijo y un siguiente número mayor que cero en cada fila.', 'warning'); return; }
    const prefixes = this.rowData.map(x => x.consecutivoTexto.trim().toUpperCase());
    if (new Set(prefixes).size !== prefixes.length) { alerts.basicAlert('Prefijo duplicado', 'Cada prefijo debe ser único dentro de la empresa.', 'warning'); return; }
    const clean = (row: ConsecutivoConfig) => ({ ...row, id: row.__isNew ? 0 : row.id, consecutivoTexto: row.consecutivoTexto.trim() });
    try {
      await Promise.all(this.rowData.filter(x => x.__isNew).map(x => lastValueFrom(this.service.create(clean(x)))));
      await Promise.all(this.rowData.filter(x => x.__modified && !x.__isNew).map(x => lastValueFrom(this.service.update(clean(x)))));
      this.hasUnsavedChanges = false;
      alerts.basicAlert('Guardado', 'La configuración de consecutivos quedó guardada.', 'success');
      this.load();
    } catch (error: any) {
      console.error('Error al guardar consecutivos', error);
      const message = error?.error && typeof error.error === 'string' ? error.error : 'No se pudieron guardar los consecutivos.';
      alerts.basicAlert('Error', message, 'error');
    }
  }

  async remove(): Promise<void> {
    if (!this.selected) { alerts.basicAlert('Eliminar', 'Selecciona un consecutivo.', 'warning'); return; }
    if (this.selected.__isNew) {
      this.rowData = this.rowData.filter(x => x !== this.selected);
      this.selected = null;
      this.hasUnsavedChanges = this.rowData.some(x => x.__isNew || x.__modified);
      this.gridApi.setGridOption('rowData', this.rowData);
      return;
    }
    try {
      await lastValueFrom(this.service.delete(this.selected.id, this.idRoot));
      this.selected = null;
      alerts.basicAlert('Eliminado', 'El consecutivo fue eliminado.', 'success');
      this.load();
    } catch (error) { console.error(error); alerts.basicAlert('Error', 'No se pudo eliminar el consecutivo.', 'error'); }
  }

  undo(): void { this.load(); }

  canDeactivate(): Promise<boolean> { return confirmExitIfUnsaved(this.hasUnsavedChanges); }

  onCellKeyDown(event: any): void {
    const keyboardEvent = event.event as KeyboardEvent;
    if (keyboardEvent.key !== 'Enter') return;
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    event.api.stopEditing();
    const columns = event.api.getAllDisplayedColumns().filter(column => column.getColDef().editable === true);
    const current = columns.findIndex(column => column.getColId() === event.column.getColId());
    const nextIndex = current + (keyboardEvent.shiftKey ? -1 : 1);
    if (nextIndex < 0 || nextIndex >= columns.length) return;
    event.api.setFocusedCell(event.rowIndex!, columns[nextIndex]);
    event.api.startEditingCell({ rowIndex: event.rowIndex!, colKey: columns[nextIndex] });
  }
}
