import { Component, effect, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, GetDetailRowDataParams, IDetailCellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { TrackingService } from 'app/services/tracking.service';

// ==================== DETAIL CELL RENDERER COMPONENT ====================
@Component({
  selector: 'app-subfamily-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="detail-container p-2 small">
      <!-- Botonera de subfamilias -->
      <div class="d-flex mb-1 align-items-center">
        <span class="badge bg-info" style="font-size: 11px;">Subfamilias de: {{ parentFamily?.description }}</span>
        <div class="d-flex gap-1 ms-auto">
          <button class="btn btn-sm btn-success py-0 px-1" style="font-size: 11px;" (click)="addSubfamily()" title="Agregar Subfamilia">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-sm btn-primary py-0 px-1 position-relative" style="font-size: 11px;" (click)="saveSubfamilies()" [disabled]="!hasChanges" title="Guardar">
            <i class="bi bi-floppy"></i> Guardar
            <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
              *ngIf="hasChanges">
            </span>
          </button>
          <button class="btn btn-sm btn-warning py-0 px-1" style="font-size: 11px;" (click)="revertSubfamilies()" title="Deshacer">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
          <button class="btn btn-sm btn-danger py-0 px-1" style="font-size: 11px;" (click)="deleteSubfamily()" [disabled]="!selectedSubfamily" title="Eliminar">
            <i class="bi bi-trash"></i> Eliminar
          </button>
        </div>
      </div>

      <!-- Grid de subfamilias -->
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        style="height: 200px; width: 100%; font-size: 12px;"
        [rowData]="subfamiliesData"
        [columnDefs]="subfamilyColDefs"
        [defaultColDef]="defaultColDef"
        [rowSelection]="'single'"
        (gridReady)="onGridReady($event)"
        (selectionChanged)="onSelectionChanged()"
        (cellValueChanged)="onCellValueChanged($event)"
      >
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-container {
      background-color: #f8f9fa;
      border-left: 4px solid #17a2b8;
      font-size: 12px;
    }
    :host ::ng-deep .small-text-ag-grid {
      font-size: 11px;
    }
    :host ::ng-deep .small-text-ag-grid .ag-header-cell-label {
      font-size: 11px;
    }
    :host ::ng-deep .small-text-ag-grid .ag-cell {
      font-size: 11px;
    }
  `]
})
export class SubfamilyDetailComponent {
  private catalogsService = inject(CatalogsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private trackingService = inject(TrackingService);

  params!: IDetailCellRendererParams;
  parentFamily: any = null;
  subfamiliesData: any[] = [];
  originalData: any[] = [];
  selectedSubfamily: any = null;
  hasChanges: boolean = false;
  gridApi!: GridApi;
  private tempIdCounter: number = 0;

  defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    editable: true,
  };

  subfamilyColDefs: ColDef[] = [
    {
      field: 'description',
      headerName: 'Descripción',
      flex: 1,
      editable: true,
    }
  ];

  agInit(params: IDetailCellRendererParams): void {
    this.params = params;
    this.parentFamily = params.data;
    this.loadSubfamilies();
  
    this.cdr.detectChanges();}

  async loadSubfamilies() {
    const context = this.params.context;
    if (context && context.allSubfamilies) {
      this.subfamiliesData = context.allSubfamilies
        .filter((s: any) => s.parentId === this.parentFamily.id)
        .map((item: any) => ({ ...item, __isNew: false, __modified: false }));
      this.originalData = JSON.parse(JSON.stringify(this.subfamiliesData));
      this.hasChanges = false;
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onSelectionChanged() {
    const selectedNodes = this.gridApi?.getSelectedNodes();
    this.selectedSubfamily = selectedNodes && selectedNodes.length > 0 ? selectedNodes[0].data : null;
  }

  onCellValueChanged(event: any) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
    this.hasChanges = true;
  }

  addSubfamily() {
    const newSubfamily = {
      id: `temp_${++this.tempIdCounter}_${Date.now()}`,
      idCompany: this.parentFamily.idCompany,
      description: '',
      valueAddition: 'NA',
      valueAdditionBit2: false,
      valueAdditionBit3: false,
      vigente: false,
      type: 'SUBFAMILY',
      parentId: this.parentFamily.id,
      active: 1,
      __isNew: true,
      __modified: false
    };
    this.subfamiliesData = [newSubfamily, ...this.subfamiliesData];
    this.hasChanges = true;

    setTimeout(() => {
      this.gridApi?.setGridOption('rowData', this.subfamiliesData);
      this.gridApi?.startEditingCell({
        rowIndex: 0,
        colKey: 'description'
      });
    }, 100);
  }

  async saveSubfamilies() {
    const newItems = this.subfamiliesData.filter(item => item.__isNew);
    const modifiedItems = this.subfamiliesData.filter(item => item.__modified && !item.__isNew);

    const invalidItems = [...newItems, ...modifiedItems].filter(item => !item.description?.trim());
    if (invalidItems.length > 0) {
      alerts.basicAlert('Error', 'Todas las subfamilias deben tener una descripción.', 'error');
      return;
    }

    try {
      for (const item of newItems) {
        const dataToSave = this.cleanDataForSave(item);
        await lastValueFrom(this.catalogsService.addCatalog(dataToSave));
      }

      for (const item of modifiedItems) {
        const dataToSave = this.cleanDataForSave(item);
        await lastValueFrom(this.catalogsService.updateCatalog(item.id, dataToSave));
      }

      alerts.basicAlert('Guardado', 'Las subfamilias se han guardado correctamente.', 'success');
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardar Subfamilias', 'Catálogo Familias/Subfamilias', this.trackingService.getEmail());

      // Reload all subfamilies in parent context
      if (this.params.context && this.params.context.reloadSubfamilies) {
        await this.params.context.reloadSubfamilies();
        this.loadSubfamilies();
      }

    } catch (error: any) {
      alerts.basicAlert('Error', `Error al guardar: ${error?.error?.message || error?.message || 'Error desconocido'}`, 'error');
    }
  
    this.cdr.detectChanges();}

  revertSubfamilies() {
    this.subfamiliesData = JSON.parse(JSON.stringify(this.originalData));
    this.hasChanges = false;
    this.gridApi?.setGridOption('rowData', this.subfamiliesData);
  }

  async deleteSubfamily() {
    if (!this.selectedSubfamily) return;

    if (this.selectedSubfamily.__isNew) {
      this.subfamiliesData = this.subfamiliesData.filter(s => s.id !== this.selectedSubfamily.id);
      this.gridApi?.setGridOption('rowData', this.subfamiliesData);
      this.selectedSubfamily = null;
      this.hasChanges = this.subfamiliesData.some(s => s.__isNew || s.__modified);
      return;
    }

    const result = await alerts.confirmAlert(
      'Eliminar Subfamilia',
      `¿Está seguro que desea eliminar "${this.selectedSubfamily.description}"?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      try {
        await lastValueFrom(this.catalogsService.deleteCatalog(this.selectedSubfamily.id));
        alerts.basicAlert('Eliminado', 'La subfamilia se ha eliminado correctamente.', 'success');
        this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminar Subfamilia', 'Catálogo Familias/Subfamilias', this.trackingService.getEmail());

        if (this.params.context && this.params.context.reloadSubfamilies) {
          await this.params.context.reloadSubfamilies();
          this.loadSubfamilies();
        }
      } catch (error: any) {
        alerts.basicAlert('Error', `Error al eliminar: ${error?.error?.message || error?.message || 'Error desconocido'}`, 'error');
      }
    }
  
    this.cdr.detectChanges();}

  private cleanDataForSave(data: any): any {
    const cleaned = { ...data };
    delete cleaned.__isNew;
    delete cleaned.__modified;
    if (typeof cleaned.id === 'string' && cleaned.id.startsWith('temp_')) {
      delete cleaned.id;
    }
    return cleaned;
  }
}

// ==================== MAIN COMPONENT ====================
@Component({
  selector: 'app-fam-subfam',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="container-fluid p-3">
      <div class="card">
        <div class="card-header bg-success text-white d-flex align-items-center">
          <h5 class="mb-0"><i class="bi bi-diagram-3 me-2"></i>Catálogo de Familias y Subfamilias</h5>
          <div class="d-flex gap-2 ms-auto">
            <button class="btn btn-sm btn-light" (click)="addFamily()" title="Agregar Familia">
              <i class="bi bi-plus-lg"></i> Agregar Familia
            </button>
            <button class="btn btn-sm btn-light position-relative" (click)="saveFamilies()" [disabled]="!hasUnsavedFamilyChanges" title="Guardar">
              <i class="bi bi-floppy"></i> Guardar
              <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
                *ngIf="hasUnsavedFamilyChanges">
              </span>
            </button>
            <button class="btn btn-sm btn-light" (click)="revertFamilies()" title="Deshacer">
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button class="btn btn-sm btn-light" (click)="deleteFamily()" [disabled]="!selectedFamily" title="Eliminar Familia">
              <i class="bi bi-trash"></i> Eliminar
            </button>
          </div>
        </div>
        <div class="card-body p-0">
          <ag-grid-angular
            class="ag-theme-quartz"
            style="height: 70vh; width: 100%;"
            [rowData]="familiesData"
            [columnDefs]="familyColDefs"
            [defaultColDef]="defaultColDef"
            [localeText]="AG_GRID_LOCALE_ES"
            [rowSelection]="'single'"
            [masterDetail]="true"
            [detailRowHeight]="280"
            [detailCellRenderer]="detailCellRenderer"
            [detailCellRendererParams]="detailCellRendererParams"
            [context]="gridContext"
            (gridReady)="onFamilyGridReady($event)"
            (selectionChanged)="onFamilySelectionChanged()"
            (cellValueChanged)="onFamilyCellValueChanged($event)"
          >
          </ag-grid-angular>
        </div>
      </div>

      <!-- Instrucciones -->
      <div class="alert alert-info mt-3">
        <i class="bi bi-info-circle me-2"></i>
        <strong>Instrucciones:</strong> Haga clic en la flecha <i class="bi bi-chevron-right"></i> de cada familia para expandir y ver/editar sus subfamilias.
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    ::ng-deep .ag-details-row {
      padding: 0 !important;
    }
  `]
})
export class FamSubfamComponent {
  private signalsService = inject(SignalsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private catalogsService = inject(CatalogsService);
  private trackingService = inject(TrackingService);

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  idCompany: number = 0;
  familyGridApi!: GridApi;
  familiesData: any[] = [];
  allSubfamilies: any[] = [];
  originalFamiliesData: any[] = [];
  selectedFamily: any = null;
  hasUnsavedFamilyChanges: boolean = false;
  private tempIdCounter: number = 0;

  // Detail cell renderer
  detailCellRenderer = SubfamilyDetailComponent;
  detailCellRendererParams: any;

  // Grid context to share data with detail renderer
  gridContext: any;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    editable: true,
  };

  familyColDefs: ColDef[] = [
    {
      field: 'description',
      headerName: 'Familia',
      flex: 1,
      editable: true,
      cellRenderer: 'agGroupCellRenderer',
    }
  ];

  constructor() {
    // Initialize context
    this.gridContext = {
      allSubfamilies: this.allSubfamilies,
      reloadSubfamilies: () => this.loadAllSubfamilies()
    };

    this.detailCellRendererParams = {
      detailGridOptions: {},
      getDetailRowData: (params: GetDetailRowDataParams) => {
        params.successCallback([]);
      }
    };

    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      if (currentRoot && currentRoot !== this.idCompany) {
        this.idCompany = currentRoot;
        this.loadFamilies();
        this.loadAllSubfamilies();
      }
    });
  }

  onFamilyGridReady(params: GridReadyEvent) {
    this.familyGridApi = params.api;
  }

  async loadFamilies() {
    try {
      const data = await lastValueFrom(this.catalogsService.getCatalogs(this.idCompany, 'FAMILY'));
      this.familiesData = data.map(item => ({ ...item, __isNew: false, __modified: false }));
      this.originalFamiliesData = JSON.parse(JSON.stringify(this.familiesData));
      this.hasUnsavedFamilyChanges = false;
      this.selectedFamily = null;
    } catch (error) {
      console.error('Error loading families:', error);
      alerts.basicAlert('Error', 'Error al cargar las familias.', 'error');
    }
  
    this.cdr.detectChanges();}

  async loadAllSubfamilies() {
    try {
      const data = await lastValueFrom(this.catalogsService.getCatalogs(this.idCompany, 'SUBFAMILY'));
      this.allSubfamilies = data;
      // Update context
      this.gridContext.allSubfamilies = this.allSubfamilies;
    } catch (error) {
      console.error('Error loading subfamilies:', error);
    }
  
    this.cdr.detectChanges();}

  onFamilySelectionChanged() {
    const selectedNodes = this.familyGridApi?.getSelectedNodes();
    this.selectedFamily = selectedNodes && selectedNodes.length > 0 ? selectedNodes[0].data : null;
  }

  onFamilyCellValueChanged(event: any) {
    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
    this.hasUnsavedFamilyChanges = true;
  }

  addFamily() {
    const newFamily = {
      id: `temp_${++this.tempIdCounter}`,
      idCompany: this.idCompany,
      description: '',
      valueAddition: 'NA',
      valueAdditionBit2: false,
      valueAdditionBit3: false,
      vigente: false,
      type: 'FAMILY',
      active: 1,
      __isNew: true,
      __modified: false
    };
    this.familiesData = [newFamily, ...this.familiesData];
    this.hasUnsavedFamilyChanges = true;

    setTimeout(() => {
      this.familyGridApi?.setGridOption('rowData', this.familiesData);
      this.familyGridApi?.startEditingCell({
        rowIndex: 0,
        colKey: 'description'
      });
    }, 100);
  }

  async saveFamilies() {
    const newItems = this.familiesData.filter(item => item.__isNew);
    const modifiedItems = this.familiesData.filter(item => item.__modified && !item.__isNew);

    const invalidItems = [...newItems, ...modifiedItems].filter(item => !item.description?.trim());
    if (invalidItems.length > 0) {
      alerts.basicAlert('Error', 'Todas las familias deben tener una descripción.', 'error');
      return;
    }

    try {
      for (const item of newItems) {
        const dataToSave = this.cleanDataForSave(item);
        await lastValueFrom(this.catalogsService.addCatalog(dataToSave));
      }

      for (const item of modifiedItems) {
        const dataToSave = this.cleanDataForSave(item);
        await lastValueFrom(this.catalogsService.updateCatalog(item.id, dataToSave));
      }

      alerts.basicAlert('Guardado', 'Las familias se han guardado correctamente.', 'success');
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardar Familias', 'Catálogo Familias/Subfamilias', this.trackingService.getEmail());

      await this.loadFamilies();
      await this.loadAllSubfamilies();

    } catch (error: any) {
      alerts.basicAlert('Error', `Error al guardar: ${error?.error?.message || error?.message || 'Error desconocido'}`, 'error');
    }
  
    this.cdr.detectChanges();}

  revertFamilies() {
    this.familiesData = JSON.parse(JSON.stringify(this.originalFamiliesData));
    this.hasUnsavedFamilyChanges = false;
    this.familyGridApi?.setGridOption('rowData', this.familiesData);
  }

  async deleteFamily() {
    if (!this.selectedFamily) {
      alerts.basicAlert('Error', 'Seleccione una familia para eliminar.', 'warning');
      return;
    }

    if (this.selectedFamily.__isNew) {
      this.familiesData = this.familiesData.filter(f => f.id !== this.selectedFamily.id);
      this.familyGridApi?.setGridOption('rowData', this.familiesData);
      this.selectedFamily = null;
      this.hasUnsavedFamilyChanges = this.familiesData.some(f => f.__isNew || f.__modified);
      return;
    }

    const hasSubfamilies = this.allSubfamilies.some(s => s.parentId === this.selectedFamily.id);
    if (hasSubfamilies) {
      alerts.basicAlert('Error', 'No se puede eliminar la familia porque tiene subfamilias asociadas. Elimine primero las subfamilias.', 'error');
      return;
    }

    const result = await alerts.confirmAlert(
      'Eliminar Familia',
      `¿Está seguro que desea eliminar la familia "${this.selectedFamily.description}"?`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      try {
        await lastValueFrom(this.catalogsService.deleteCatalog(this.selectedFamily.id));
        alerts.basicAlert('Eliminado', 'La familia se ha eliminado correctamente.', 'success');
        this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminar Familia', 'Catálogo Familias/Subfamilias', this.trackingService.getEmail());
        await this.loadFamilies();
        await this.loadAllSubfamilies();
      } catch (error: any) {
        alerts.basicAlert('Error', `Error al eliminar: ${error?.error?.message || error?.message || 'Error desconocido'}`, 'error');
      }
    }
  
    this.cdr.detectChanges();}

  private cleanDataForSave(data: any): any {
    const cleaned = { ...data };
    delete cleaned.__isNew;
    delete cleaned.__modified;
    if (typeof cleaned.id === 'string' && cleaned.id.startsWith('temp_')) {
      delete cleaned.id;
    }
    return cleaned;
  }
}
