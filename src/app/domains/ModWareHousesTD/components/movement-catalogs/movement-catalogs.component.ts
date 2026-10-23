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
  private readonly behaviorsForType = (type: 'IN' | 'OUT') => this.behaviorOptions[type];
  private readonly behaviorOptions: Record<'IN' | 'OUT', readonly { value: string; label: string }[]> = {
    IN: [
      { value: 'STANDARD', label: 'Normal' },
      { value: 'TRANSFER', label: 'Traspaso' },
      { value: 'INITIAL_INVENTORY', label: 'Inicio de inventario' },
      { value: 'INVENTORY_ADJUSTMENT', label: 'Ajuste de inventario' }
    ],
    OUT: [
      { value: 'STANDARD', label: 'Normal' },
      { value: 'TRANSFER', label: 'Traspaso' },
      { value: 'INITIAL_INVENTORY', label: 'Inicio de inventario' },
      { value: 'INVENTORY_ADJUSTMENT', label: 'Ajuste de inventario' }
    ]
  };
  private readonly signals = inject(SignalsService);
  private readonly catalogsService = inject(CatalogsService);
  private gridApi?: GridApi;

  readonly AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  readonly movementTypes = [
    { value: 'IN', label: 'Entradas' },
    { value: 'BRAND', label: 'Marcas' },
    { value: 'OUT', label: 'Salidas' }
  ] as const;
  idRoot = 0;
  selectedType: 'IN' | 'OUT' | 'BRAND' = 'IN';
  rowData: any[] = [];
  loading = false;
  saving = false;
  hasUnsavedChanges = false;

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1 };
  get columnDefs(): ColDef[] {
    const movementType = this.selectedType !== 'BRAND';
    const behaviorOptions = this.behaviorsForType(this.selectedType === 'OUT' ? 'OUT' : 'IN');
    return [
      { field: 'description', headerName: movementType ? 'Tipo de movimiento' : 'Marca', editable: true, minWidth: 280 },
      {
        field: 'valueAddition', headerName: 'Comportamiento', editable: true, minWidth: 220,
        hide: !movementType,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: behaviorOptions.map(option => option.value),
          formatValue: (value: string) => behaviorOptions.find(option => option.value === value)?.label || value
        }),
        valueFormatter: params => behaviorOptions.find(option => option.value === params.value)?.label || params.value || 'Normal'
      },
      {
        headerName: 'Estado', field: 'active', width: 130, maxWidth: 150, editable: false,
        valueFormatter: params => params.value === false || Number(params.value) === 0 ? 'Inactivo' : 'Activo'
      }
    ];
  }

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

  selectType(type: 'IN' | 'OUT' | 'BRAND'): void {
    if (this.hasUnsavedChanges) {
      void this.confirmDiscard().then(discard => {
        if (!discard) return;
        this.selectedType = type;
        this.gridApi?.setGridOption('columnDefs', this.columnDefs);
        this.loadCatalogs();
      });
      return;
    }
    this.selectedType = type;
    this.gridApi?.setGridOption('columnDefs', this.columnDefs);
    this.loadCatalogs();
  }

  add(): void {
    const row = { id: `new-${Date.now()}`, idCompany: this.idRoot, type: this.selectedType, description: '', valueAddition: this.selectedType === 'BRAND' ? 'NA' : 'STANDARD', active: 1, vigente: true, __isNew: true, __modified: true };
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
      alerts.basicAlert('Empresa requerida', 'Selecciona una empresa para administrar este catálogo.', 'warning');
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
          idCompany: this.idRoot,
          description: String(row.description).trim(),
          valueAddition: this.selectedType === 'BRAND' ? 'NA' : this.normalizeBehavior(row.valueAddition),
          type: this.selectedType,
          active: Number(row.active ?? 1),
          vigente: row.vigente ?? true
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
      alerts.basicAlert('Catálogos actualizados', `${this.catalogLabel} se guardó correctamente.`, 'success');
    } catch (error) {
      console.error(`Error al guardar ${this.catalogLabel}:`, error);
      const apiMessage = typeof error?.error === 'string'
        ? error.error
        : error?.error?.message || error?.error?.Message;
      alerts.basicAlert(
        'Error',
        apiMessage || `No se pudo guardar ${this.catalogLabel}${error?.status ? ` (HTTP ${error.status})` : ''}.`,
        'error'
      );
    } finally {
      this.saving = false;
    }
  }

  async deleteSelected(): Promise<void> {
    const selected = this.gridApi?.getSelectedRows() || [];
    if (!selected.length) {
      alerts.basicAlert('Selecciona un registro', `Elige en el grid el registro de ${this.catalogLabel} que quieres eliminar.`, 'info');
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
    const result = await alerts.confirmAlert(`Eliminar ${this.catalogLabel}`, `¿Quieres eliminar “${row.description}”?`, 'warning', 'Eliminar');
    if (!result.isConfirmed) return;
    try {
      await lastValueFrom(this.catalogsService.deleteCatalog(Number(row.id)));
      await this.loadCatalogs();
      alerts.basicAlert('Registro eliminado', `${this.catalogLabel} se eliminó correctamente.`, 'success');
    } catch (error) {
      console.error(`Error al eliminar ${this.catalogLabel}:`, error);
      alerts.basicAlert('Error', `No se pudo eliminar ${this.catalogLabel}.`, 'error');
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
        valueAddition: this.selectedType === 'BRAND' ? row.valueAddition || 'NA' : this.resolveBehavior(row.valueAddition),
        __modified: false,
        __isNew: false
      }));
      this.hasUnsavedChanges = false;
    } catch (error) {
      console.error(`Error al cargar ${this.catalogLabel}:`, error);
      this.rowData = [];
      alerts.basicAlert('Error', `No se pudo cargar ${this.catalogLabel} de la empresa seleccionada.`, 'error');
    } finally {
      this.loading = false;
    }
  }

  get catalogLabel(): string {
    return this.selectedType === 'BRAND' ? 'el catálogo de marcas' : 'los tipos de movimiento';
  }

  private async confirmDiscard(): Promise<boolean> {
    const result = await alerts.confirmAlert('Cambios sin guardar', 'Si cambias de catálogo, se descartarán los cambios pendientes.', 'warning', 'Descartar cambios');
    return result.isConfirmed;
  }

  private normalizeBehavior(value: any): string {
    const normalized = String(value || '').trim().toUpperCase();
    const options = this.behaviorsForType(this.selectedType === 'OUT' ? 'OUT' : 'IN');
    return options.some(option => option.value === normalized) ? normalized : 'STANDARD';
  }

  private resolveBehavior(value: any): string {
    const normalized = String(value || '').trim().toUpperCase();
    const options = this.behaviorsForType(this.selectedType === 'OUT' ? 'OUT' : 'IN');
    if (options.some(option => option.value === normalized)) return normalized;
    return 'STANDARD';
  }

  canDeactivate(): boolean | Promise<boolean> {
    return this.hasUnsavedChanges ? this.confirmDiscard() : true;
  }
}
