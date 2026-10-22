import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-movement-catalogs',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './movement-catalogs.component.html',
  styleUrl: './movement-catalogs.component.scss'
})
export class MovementCatalogsComponent implements CanComponentDeactivate {
  private readonly behaviorOptions: Record<'IN' | 'OUT', readonly { value: string; label: string }[]> = {
    IN: [
      { value: 'STANDARD', label: 'Normal' },
      { value: 'TRANSFER', label: 'Traspaso' },
      { value: 'INITIAL_INVENTORY', label: 'Inicio de inventario' },
      { value: 'INVENTORY_ADJUSTMENT', label: 'Ajuste de inventario' }
    ],
    OUT: [
      { value: 'STANDARD', label: 'Normal' },
      { value: 'TRANSFER', label: 'Traspaso' }
    ]
  };
  private readonly signals = inject(SignalsService);
  private readonly catalogsService = inject(CatalogsService);
  private gridApi?: GridApi;

  readonly AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  readonly movementTypes = [
    { value: 'IN', label: 'Entradas' },
    { value: 'OUT', label: 'Salidas' }
  ] as const;
  idRoot = 0;
  selectedType: 'IN' | 'OUT' = 'IN';
  rowData: any[] = [];
  loading = false;
  saving = false;
  hasUnsavedChanges = false;

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1 };
  readonly columnDefs: ColDef[] = [
    { field: 'description', headerName: 'Tipo de movimiento', editable: true, minWidth: 280 },
    {
      field: 'valueAddition', headerName: 'Comportamiento', editable: true, minWidth: 220,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: () => ({
        values: this.behaviorOptions[this.selectedType].map(option => option.value),
        formatValue: (value: string) => this.behaviorOptions[this.selectedType].find(option => option.value === value)?.label || value
      }),
      valueFormatter: params => this.behaviorOptions[this.selectedType].find(option => option.value === params.value)?.label || params.value || 'Normal'
    },
    {
      headerName: 'Estado', field: 'active', width: 130, maxWidth: 150, editable: false,
      valueFormatter: params => params.value === false || Number(params.value) === 0 ? 'Inactivo' : 'Activo'
    }
  ];

  constructor() {
    effect(() => {
      const rootId = Number(this.signals.getRootSelectedBySidebar()() || 0);
      if (rootId === this.idRoot) return;
      this.idRoot = rootId;
      this.loadCatalogs();
    });
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  selectType(type: 'IN' | 'OUT'): void {
    if (this.hasUnsavedChanges) {
      void this.confirmDiscard().then(discard => {
        if (!discard) return;
        this.selectedType = type;
        this.loadCatalogs();
      });
      return;
    }
    this.selectedType = type;
    this.loadCatalogs();
  }

  add(): void {
    const row = { id: `new-${Date.now()}`, idCompany: this.idRoot, type: this.selectedType, description: '', valueAddition: 'STANDARD', active: 1, vigente: true, __isNew: true, __modified: true };
    this.rowData = [...this.rowData, row];
    this.hasUnsavedChanges = true;
    setTimeout(() => this.gridApi?.startEditingCell({ rowIndex: this.rowData.length - 1, colKey: 'description' }));
  }

  onCellValueChanged(event: any): void {
    const description = String(event.data?.description || '').trim();
    event.data.description = description;
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
    event.api.refreshCells({ rowNodes: [event.node], force: true });
  }

  async save(): Promise<void> {
    if (!this.idRoot) {
      alerts.basicAlert('Empresa requerida', 'Selecciona una empresa para administrar sus tipos de movimiento.', 'warning');
      return;
    }
    const changedRows = this.rowData.filter(row => row.__isNew || row.__modified);
    if (!changedRows.length) return;
    const emptyRow = changedRows.find(row => !String(row.description || '').trim());
    if (emptyRow) {
      alerts.basicAlert('Descripción requerida', 'Completa la descripción de cada tipo de movimiento antes de guardar.', 'warning');
      return;
    }

    this.saving = true;
    try {
      for (const row of changedRows) {
        const payload = {
          ...row,
          description: String(row.description).trim(),
          valueAddition: this.normalizeBehavior(row.valueAddition),
          idCompany: this.idRoot,
          type: this.selectedType
        };
        if (row.__isNew) {
          const created: any = await lastValueFrom(this.catalogsService.addCatalog(payload));
          row.id = created?.id ?? created?.data?.id ?? row.id;
          row.__isNew = false;
        } else {
          await lastValueFrom(this.catalogsService.updateCatalog(Number(row.id), payload));
        }
        row.__modified = false;
      }
      this.hasUnsavedChanges = false;
      await this.loadCatalogs();
      alerts.basicAlert('Catálogos actualizados', 'Los tipos de movimiento se guardaron correctamente.', 'success');
    } catch (error) {
      console.error('Error al guardar los tipos de movimiento:', error);
      alerts.basicAlert('Error', 'No se pudieron guardar los tipos de movimiento.', 'error');
    } finally {
      this.saving = false;
    }
  }

  async deleteSelected(): Promise<void> {
    const selected = this.gridApi?.getSelectedRows() || [];
    if (!selected.length) {
      alerts.basicAlert('Selecciona un tipo', 'Elige en el grid el tipo de movimiento que quieres eliminar.', 'info');
      return;
    }
    const row = selected[0];
    if (row.__isNew) {
      this.rowData = this.rowData.filter(item => item !== row);
      this.hasUnsavedChanges = this.rowData.some(item => item.__isNew || item.__modified);
      return;
    }
    if (this.hasUnsavedChanges) {
      alerts.basicAlert('Guarda los cambios', 'Guarda o descarta los cambios pendientes antes de eliminar un tipo.', 'info');
      return;
    }
    const result = await alerts.confirmAlert('Eliminar tipo de movimiento', `¿Quieres eliminar “${row.description}”?`, 'warning', 'Eliminar');
    if (!result.isConfirmed) return;
    try {
      await lastValueFrom(this.catalogsService.deleteCatalog(Number(row.id)));
      await this.loadCatalogs();
      alerts.basicAlert('Tipo eliminado', 'El tipo de movimiento se eliminó correctamente.', 'success');
    } catch (error) {
      console.error('Error al eliminar el tipo de movimiento:', error);
      alerts.basicAlert('Error', 'No se pudo eliminar el tipo de movimiento.', 'error');
    }
  }

  private async loadCatalogs(): Promise<void> {
    if (!this.idRoot) {
      this.rowData = [];
      return;
    }
    this.loading = true;
    try {
      const data = await lastValueFrom(this.catalogsService.getCatalogs(this.idRoot, this.selectedType));
      this.rowData = (data || []).map(row => ({
        ...row,
        valueAddition: this.resolveBehavior(row.valueAddition, row.description),
        __modified: false,
        __isNew: false
      }));
      this.hasUnsavedChanges = false;
    } catch (error) {
      console.error('Error al cargar los tipos de movimiento:', error);
      this.rowData = [];
      alerts.basicAlert('Error', 'No se pudieron cargar los tipos de movimiento de la empresa seleccionada.', 'error');
    } finally {
      this.loading = false;
    }
  }

  private async confirmDiscard(): Promise<boolean> {
    const result = await alerts.confirmAlert('Cambios sin guardar', 'Si cambias de catálogo, se descartarán los cambios pendientes.', 'warning', 'Descartar cambios');
    return result.isConfirmed;
  }

  private normalizeBehavior(value: any): string {
    const normalized = String(value || '').trim().toUpperCase();
    return this.behaviorOptions[this.selectedType].some(option => option.value === normalized) ? normalized : 'STANDARD';
  }

  private resolveBehavior(value: any, description: any): string {
    const normalized = String(value || '').trim().toUpperCase();
    if (this.behaviorOptions[this.selectedType].some(option => option.value === normalized)) return normalized;

    // Conserva el comportamiento de registros antiguos mientras se clasifican desde Catálogos.
    const name = String(description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (name === 'TRASPASO') return 'TRANSFER';
    if (this.selectedType === 'IN' && name === 'INICIO INVENTARIOS') return 'INITIAL_INVENTORY';
    if (this.selectedType === 'IN' && name === 'AJUSTE DE INVENTARIOS') return 'INVENTORY_ADJUSTMENT';
    return 'STANDARD';
  }

  canDeactivate(): boolean | Promise<boolean> {
    return this.hasUnsavedChanges ? this.confirmDiscard() : true;
  }
}
