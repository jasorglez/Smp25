import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE } from 'assets/i18n/ag-grid.locale';
import { alerts } from 'app/helpers/alerts';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';
import { catchError, lastValueFrom, of, throwError } from 'rxjs';
import { BranchsService } from 'app/services/branchs.service';
import { WarehousesService } from 'app/services/warehouses.service';
import { InandoutService } from 'app/services/inandout.service';
import { MaterialsService } from 'app/services/materials.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-movement-catalogs',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, TranslateModule],
  templateUrl: './movement-catalogs.component.html',
  styleUrl: './movement-catalogs.component.scss'
})
export class MovementCatalogsComponent implements CanComponentDeactivate {
  private readonly translate = inject(TranslateService);
  private readonly behaviorsForType = (type: 'IN' | 'OUT') => this.behaviorOptions[type];
  private readonly behaviorOptions: Record<'IN' | 'OUT', readonly { value: string; label: string }[]> = {
    IN: [
      { value: 'STANDARD', label: this.translate.instant('modules.warehouses.movementCatalogs.normal') },
      { value: 'TRANSFER', label: this.translate.instant('modules.warehouses.movementCatalogs.transfer') },
      { value: 'INITIAL_INVENTORY', label: this.translate.instant('modules.warehouses.movementCatalogs.initialInventory') },
      { value: 'INVENTORY_ADJUSTMENT', label: this.translate.instant('modules.warehouses.movementCatalogs.inventoryAdjustment') }
    ],
    OUT: [
      { value: 'STANDARD', label: this.translate.instant('modules.warehouses.movementCatalogs.normal') },
      { value: 'TRANSFER', label: this.translate.instant('modules.warehouses.movementCatalogs.transfer') },
      { value: 'INITIAL_INVENTORY', label: this.translate.instant('modules.warehouses.movementCatalogs.initialInventory') },
      { value: 'INVENTORY_ADJUSTMENT', label: this.translate.instant('modules.warehouses.movementCatalogs.inventoryAdjustment') }
    ]
  };
  private readonly signals = inject(SignalsService);
  private readonly catalogsService = inject(CatalogsService);
  private readonly branchesService = inject(BranchsService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly inAndOutService = inject(InandoutService);
  private readonly materialsService = inject(MaterialsService);
  private gridApi?: GridApi;

  readonly AG_GRID_LOCALE_ES = AG_GRID_LOCALE;
  readonly movementTypes = [
      { value: 'IN', label: this.translate.instant('modules.warehouses.movementCatalogs.entries') },
    { value: 'BRAND', label: this.translate.instant('modules.warehouses.movementCatalogs.brands') },
    { value: 'OUT', label: this.translate.instant('modules.warehouses.movementCatalogs.issues') }
  ] as const;
  idRoot = 0;
  selectedType: 'IN' | 'OUT' | 'BRAND' = 'IN';
  rowData: any[] = [];
  loading = false;
  saving = false;
  deleting = false;
  hasUnsavedChanges = false;

  readonly defaultColDef: ColDef = { sortable: true, filter: true, resizable: true, flex: 1 };
  get columnDefs(): ColDef[] {
    const movementType = this.selectedType !== 'BRAND';
    const behaviorOptions = this.behaviorsForType(this.selectedType === 'OUT' ? 'OUT' : 'IN');
    return [
      { field: 'description', headerName: movementType ? this.translate.instant('modules.warehouses.movementCatalogs.movementType') : this.translate.instant('modules.warehouses.movementCatalogs.brand'), editable: true, minWidth: 280 },
      {
        field: 'valueAddition', headerName: this.translate.instant('modules.warehouses.movementCatalogs.behavior'), editable: true, minWidth: 220,
        hide: !movementType,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: behaviorOptions.map(option => option.value),
          formatValue: (value: string) => behaviorOptions.find(option => option.value === value)?.label || value
        }),
        valueFormatter: params => behaviorOptions.find(option => option.value === params.value)?.label || params.value || this.translate.instant('modules.warehouses.movementCatalogs.normal')
      },
      {
        headerName: this.translate.instant('modules.warehouses.movementCatalogs.status'), field: 'active', width: 130, maxWidth: 150, editable: false,
        valueFormatter: params => params.value === false || Number(params.value) === 0 ? this.translate.instant('modules.warehouses.movementCatalogs.inactive') : this.translate.instant('modules.warehouses.movementCatalogs.active')
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
    if (this.deleting) return;
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
      alerts.basicAlert(this.translate.instant('modules.warehouses.movementCatalogs.companyRequired'), this.translate.instant('modules.warehouses.movementCatalogs.selectCompanyForCatalog'), 'warning');
      return;
    }
    const changedRows = this.rowData.filter(row => row.__isNew || row.__modified);
    if (!changedRows.length) return;
    const emptyRow = changedRows.find(row => !String(row.description || '').trim());
    if (emptyRow) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.movementCatalogs.descriptionRequired'), this.translate.instant('modules.warehouses.movementCatalogs.completeDescription'), 'warning');
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
      alerts.basicAlert(this.translate.instant('modules.warehouses.movementCatalogs.catalogsUpdated'), `${this.catalogLabel} ${this.translate.instant('modules.warehouses.movementCatalogs.savedSuccessfully')}`, 'success');
    } catch (error) {
      console.error(`Error al guardar ${this.catalogLabel}:`, error);
      const apiMessage = typeof error?.error === 'string'
        ? error.error
        : error?.error?.message || error?.error?.Message;
      alerts.basicAlert(
        this.translate.instant('error'),
        apiMessage || this.translate.instant('modules.warehouses.movementCatalogs.saveFailed', { catalogLabel: this.catalogLabel, status: error?.status ? ` (HTTP ${error.status})` : '' }),
        'error'
      );
    } finally {
      this.saving = false;
    }
  }

  async deleteSelected(): Promise<void> {
    if (this.deleting || this.saving || this.loading) return;
    const selected = this.gridApi?.getSelectedRows() || [];
    if (!selected.length) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.movementCatalogs.selectRecord'), `${this.translate.instant('modules.warehouses.movementCatalogs.chooseRecord')} ${this.catalogLabel} ${this.translate.instant('modules.warehouses.movementCatalogs.toDelete')}`, 'info');
      return;
    }
    const row = selected[0];
    if (row.__isNew) {
      this.rowData = this.rowData.filter(item => item !== row);
      this.hasUnsavedChanges = this.rowData.some(item => item.__isNew || item.__modified);
      return;
    }
    if (this.hasUnsavedChanges) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.movementCatalogs.saveChanges'), this.translate.instant('modules.warehouses.movementCatalogs.saveOrDiscard'), 'info');
      return;
    }
    this.deleting = true;
    const catalogType = this.selectedType;
    const companyId = this.idRoot;
    try {
      const result = await this.getCatalogUsage(row, catalogType, companyId);
      if (result.inUse) {
        alerts.basicAlert(this.translate.instant('modules.warehouses.movementCatalogs.cannotDelete'), result.message, 'warning');
        return;
      }
      const confirmation = await alerts.confirmAlert(`${this.translate.instant('delete')} ${this.catalogLabel}`, `${this.translate.instant('modules.warehouses.movementCatalogs.confirmDelete')} “${row.description}”?`, 'warning', this.translate.instant('delete'));
      if (!confirmation.isConfirmed) return;
      if (this.idRoot !== companyId || this.selectedType !== catalogType) return;
      await lastValueFrom(this.catalogsService.deleteCatalog(Number(row.id)));
      await this.loadCatalogs();
      alerts.basicAlert(this.translate.instant('modules.warehouses.movementCatalogs.recordDeleted'), `${this.catalogLabel} ${this.translate.instant('modules.warehouses.movementCatalogs.deletedSuccessfully')}`, 'success');
    } catch (error) {
      console.error(`Error al validar/eliminar ${this.catalogLabel}:`, error);
      alerts.basicAlert(this.translate.instant('modules.warehouses.movementCatalogs.couldNotValidate'), this.translate.instant('modules.warehouses.movementCatalogs.validationFailed'), 'error');
    } finally {
      this.deleting = false;
    }
  }

  private async getCatalogUsage(row: any, catalogType: 'IN' | 'OUT' | 'BRAND', companyId: number): Promise<{ inUse: boolean; message: string }> {
    const catalogId = Number(row?.id);
    if (!catalogId || !companyId) throw new Error('Falta el identificador de empresa o catálogo.');

    if (catalogType === 'BRAND') {
      const relations: any = await lastValueFrom(this.materialsService.getMaterialBrands(companyId).pipe(
        catchError(error => error?.status === 404 ? of([]) : throwError(() => error))
      ));
      const rows = this.asArray(relations);
      const usedBy = rows.filter((relation: any) =>
        Number(relation?.id ?? relation?.idBrand ?? relation?.brandId) === catalogId
      );
      return {
        inUse: usedBy.length > 0,
        message: `La marca “${row.description}” está asignada a ${usedBy.length} material(es). Retírala de esos materiales antes de eliminarla.`
      };
    }

    const branchesResponse: any = await lastValueFrom(this.branchesService.getBranches2fields(companyId).pipe(
      catchError(error => error?.status === 404 ? of([]) : throwError(() => error))
    ));
    const branches = this.asArray(branchesResponse);
    const branchIds = [...new Set(branches.map((branch: any) => Number(branch?.id ?? branch?.idBranch)).filter((id: number) => id > 0))];
    if (!branchIds.length) return { inUse: false, message: '' };

    const warehouseGroups = await Promise.all(branchIds.map(async branchId => {
      const response: any = await lastValueFrom(this.warehousesService.getWarehouses(branchId).pipe(
        catchError(error => error?.status === 404 ? of([]) : throwError(() => error))
      ));
      return this.asArray(response);
    }));
    const warehouseIds = [...new Set(warehouseGroups.flat()
      .map((warehouse: any) => Number(warehouse?.idAlmacen ?? warehouse?.idWarehouse ?? warehouse?.warehouseId ?? warehouse?.id))
      .filter((id: number) => id > 0))];
    if (!warehouseIds.length) return { inUse: false, message: '' };

    const movementGroups = await Promise.all(warehouseIds.map(async warehouseId => {
      const response: any = await lastValueFrom(this.inAndOutService.getInAndOuts(null, warehouseId, catalogType).pipe(
        catchError(error => error?.status === 404 ? of([]) : throwError(() => error))
      ));
      return this.asArray(response);
    }));
    const uses = movementGroups.flat().filter((movement: any) => Number(movement?.idType) === catalogId);
    const movementLabel = catalogType === 'IN' ? 'entrada(s)' : 'salida(s)';
    return {
      inUse: uses.length > 0,
      message: `El tipo “${row.description}” ya está usado en ${uses.length} ${movementLabel}. No se puede eliminar.`
    };
  }

  private asArray(response: any): any[] {
    if (Array.isArray(response)) return response;
    const nested = response?.data ?? response?.result ?? response?.items;
    return Array.isArray(nested) ? nested : [];
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
      alerts.basicAlert(this.translate.instant('error'), `${this.translate.instant('modules.warehouses.movementCatalogs.couldNotLoad')} ${this.catalogLabel} ${this.translate.instant('modules.warehouses.movementCatalogs.fromSelectedCompany')}`, 'error');
    } finally {
      this.loading = false;
    }
  }

  get catalogLabel(): string {
    return this.translate.instant(this.selectedType === 'BRAND'
      ? 'modules.warehouses.movementCatalogs.brandsCatalog'
      : 'modules.warehouses.movementCatalogs.movementTypes');
  }

  private async confirmDiscard(): Promise<boolean> {
    const result = await alerts.confirmAlert(this.translate.instant('modules.userSetup.unsavedChanges'), this.translate.instant('modules.warehouses.movementCatalogs.switchCatalogWarning'), 'warning', this.translate.instant('modules.warehouses.movementCatalogs.discardChanges'));
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
