import {
  Component,
  effect,
  HostListener,
  inject,
  Renderer2,
  RendererFactory2,
} from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray, tap } from 'rxjs';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import {
  CellDoubleClickedEvent,
  IFilterComp,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { TrackingService } from 'app/services/tracking.service';
import { MaterialsService } from 'app/services/materials.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { CommonModule } from '@angular/common';
import { FamilyModalService } from './services/family-modal.service';
import { SubfamilyModalService } from './services/subfamily-modal.service';
import { MeasureModalService } from './services/measure-modal.service';
import { MaterialDetailRendererComponent } from './material-detail-renderer.component';
import { PdfMaterialsDistributionComponent } from './pdf-materials-distribution.component';

@Component({
  selector: 'custom-group-renderer',
  standalone: true,
  template: `
    <div class="ag-group-row">
      <span
        class="ag-group-expanded"
        [class.ag-group-contracted]="!params.node.expanded"
        (click)="onToggleExpand()"
      ></span>
      <span>{{ displayText }}</span>
    </div>
  `,
  styles: [`
    .ag-group-row {
      display: flex;
      align-items: center;
    }
    .ag-group-expanded {
      width: 12px;
      height: 12px;
      margin-right: 4px;
      cursor: pointer;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M4 6L0 2h8z"/></svg>') no-repeat center;
      background-size: 12px;
    }
    .ag-group-contracted {
      transform: rotate(-90deg);
    }
  `]
})
export class CustomGroupRendererComponent implements ICellRendererAngularComp {
  params: any;
  displayText: string = '';

  agInit(params: any): void {
    this.params = params;
    const field = params.node.rowGroupColumn?.getColDef()?.field;
    if (field === 'familiaDescription') {
      this.displayText = `Familia: ${params.value}`;
    } else if (field === 'subfamiliaDescription') {
      this.displayText = `Subfamilia: ${params.value}`;
    } else {
      this.displayText = params.value;
    }
  }

  onToggleExpand(): void {
    this.params.node.setExpanded(!this.params.node.expanded);
  }

  refresh(params: any): boolean {
    this.params = params;
    return true;
  }
}

@Component({
  selector: 'storeComponent',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, CustomGroupRendererComponent, SelectWithTooltipEditorV2Component, MaterialDetailRendererComponent, PdfMaterialsDistributionComponent],
  templateUrl: './productos.component.html',
  styles: `
    ::ng-deep .small-text-ag-grid {
      font-size: 12px;
    }
    ::ng-deep .small-text-ag-grid .ag-header-cell-text {
      font-size: 11px;
    }
    ::ng-deep .small-text-ag-grid .ag-cell-value {
      font-size: 11px;
    }
  `
})
export class MaterialsComponent implements CanComponentDeactivate {
  idcompany: number = null;
  rowData: any[] = [];
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];
  gridHeight: string = '85vh';
  id: number = null;
  idBranch: number;
  idUser: number = null;
  notSavedChanges: boolean = false;
  showLoansTab: boolean = false;
  selectedRowData: any = null;
  showSavingsTab: boolean = false;
  authorizedPass: boolean = false;
  private lastEditedRowId: number | string | null = null;
  newlyAddedRows: string[] = [];
  unitsCatalog: any[] = [];
  selectedImage: string = '';
  familiasCatalog: any[] = [];
  subfamiliasCatalog: any[] = [];  // Todas las subfamilias
  subfamiliasFiltered: any[] = []; // Subfamilias filtradas por familia seleccionada


  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private materialsService = inject(MaterialsService);
  private catalogsService = inject(CatalogsService);
  private familyModalService = inject(FamilyModalService);
  private subfamilyModalService = inject(SubfamilyModalService);
  private measureModalService = inject(MeasureModalService);
  private isOpen: boolean = false;

  showPdfReport: boolean = false;
  showPdfMoneyReport: boolean = false;
  private savedRowData: any[] | null = null;

  // Variables para modal de familia
  showFamilyModal: boolean = false;
  newFamily: any = {};

  // Variables para modal de subfamilia
  showSubfamilyModal: boolean = false;
  newSubfamily: any = {};
  selectedParentFamilyDescription: string = '';

  // Variables para modal de unidad
  showMeasureModal: boolean = false;
  newMeasure: any = {};
  private renderer: Renderer2;
  private tooltipElement: HTMLElement | null = null;

  // Caché para columnas del maestro (evita parpadeo/re-renderizado)
  private _colMaster: ColDef[] = [];

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    customGroupRenderer: CustomGroupRendererComponent,
  };

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1,
  };
  private cleanDataForServer(data: any, isNew: boolean = false): any {
    const cleanedData = { ...data };

    // Eliminar siempre estos campos internos
    delete cleanedData.__isNew;
    delete cleanedData.__modified;

    // Solo eliminar id para registros nuevos (tiene id temporal)
    if (isNew || (cleanedData.id && cleanedData.id.toString().startsWith('temp_'))) {
      delete cleanedData.id;
    }

    // Eliminar campos de la vista que no existen en la tabla
    delete cleanedData.familiaDescription;
    delete cleanedData.subfamiliaDescription;
    delete cleanedData.materialDescription;
    delete cleanedData.existencia;

    // Mapear campos requeridos por el servidor
    cleanedData.description = data.materialDescription || '';
    cleanedData.barCode = data.barcode || '';

    // Asegurar que los IDs de familia y subfamilia estén presentes
    cleanedData.idFamilia = data.idFamilia || null;
    cleanedData.idSubfamilia = data.idSubfamilia || null;
    cleanedData.idMedida = data.idMedida || null;
    cleanedData.idCompany = this.idcompany;

    return cleanedData;
  }

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);

    effect(() => {
      const currentRoot = this.signalsService.getRootSelectedBySidebar()();
      const currentUser = this.signalsService.getIdUSer()();
      const currentBranch = this.signalsService.getBranchSelectedBySidebar()();

      // Solo recargar si cambió el root (empresa) y tiene valor válido
      const rootChanged = this.idcompany !== currentRoot;

      this.idUser = currentUser;
      this.idBranch = currentBranch;

      if (rootChanged && currentRoot) {
        this.idcompany = currentRoot;
        this.obtenerDatos();
        this.obtenerUnidades();
        this.obtenerFamilias();
        this.obtenerSubfamilias();
      }
    });

    // Suscribirse a solicitudes de apertura del modal de familia
    this.familyModalService.modalRequest$.subscribe((data) => {
      this.openFamilyModal(data.idCompany);
    });

    // Suscribirse a confirmación de guardado de familia
    this.familyModalService.saveConfirmed$.subscribe((familyData) => {
      this.onFamilyCreated(familyData);
    });

    // Suscribirse a solicitudes de apertura del modal de subfamilia
    this.subfamilyModalService.modalRequest$.subscribe((data) => {
      this.openSubfamilyModal(data.idCompany, data.parentId, data.parentDescription);
    });

    // Suscribirse a confirmación de guardado de subfamilia
    this.subfamilyModalService.saveConfirmed$.subscribe((subfamilyData) => {
      this.onSubfamilyCreated(subfamilyData);
    });

    // Suscribirse a solicitudes de apertura del modal de unidad
    this.measureModalService.modalRequest$.subscribe((data) => {
      this.openMeasureModal(data.idCompany);
    });

    // Suscribirse a confirmación de guardado de unidad
    this.measureModalService.saveConfirmed$.subscribe((measureData) => {
      this.onMeasureCreated(measureData);
    });
  }
  obtenerDatos(){
    return this.materialsService.getAllMaterialsxFamilyview(this.idcompany).subscribe(
      (data: any) => {
        this.rowData = data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerUnidades(){
    return this.catalogsService.getUnits(this.idcompany).subscribe(
      (data: any) => {
        this.unitsCatalog = data;
        this.refreshColumnCache();
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerFamilias() {
    return this.catalogsService.getCatalogs(this.idcompany, 'FAMILY').subscribe(
      (data: any) => {
        this.familiasCatalog = data;
        this.refreshColumnCache();
      },
      (error) => console.error('Error fetching familias:', error)
    );
  }

  obtenerSubfamilias() {
    return this.catalogsService.getCatalogs(this.idcompany, 'SUBFAMILY').subscribe(
      (data: any) => {
        this.subfamiliasCatalog = data;
        this.subfamiliasFiltered = data;
        this.refreshColumnCache();
      },
      (error) => console.error('Error fetching subfamilias:', error)
    );
  }

  // Filtra subfamilias por el parentId de la familia seleccionada
  filtrarSubfamiliasPorFamilia(idFamilia: number) {
    if (idFamilia) {
      this.subfamiliasFiltered = this.subfamiliasCatalog.filter(s => s.parentId === idFamilia);
    } else {
      this.subfamiliasFiltered = this.subfamiliasCatalog;
    }
  }

  

  public gridOptions: any = {
    stopEditingWhenCellsLoseFocus: false,
    headerHeight: 50,
    rowHeight: 20,
    groupDefaultExpanded: -1,
    suppressDragLeaveHidesColumns: true,
    suppressMakeColumnVisibleAfterUnGroup: true,
    rowBuffer: 20,
    // Full-width row para distribución
    isFullWidthRow: (params: any) => !!params.rowNode.data?.__isDistDetail,
    fullWidthCellRenderer: MaterialDetailRendererComponent,
    getRowHeight: (params: any) => params.node.data?.__isDistDetail ? 420 : 20,
    context: { componentParent: this },
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      // Deseleccionar otras filas cuando se selecciona una nueva
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onCellKeyDown: (params) => {
      if (params.event.key === 'Enter') {
        // Obtener todas las columnas editables
        const editableColumns = this.colMaster.filter((col) => col.editable);
        const currentColIndex = editableColumns.findIndex(
          (col) => col.field === params.column.getColDef().field
        );

        if (currentColIndex < editableColumns.length - 1) {
          // Añadir delay de 50ms antes de mover el foco
          requestAnimationFrame(() => {
            // Mover a la siguiente columna editable
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: editableColumns[currentColIndex + 1].field,
            });
          }); // Retraso para permitir que termine la edición actual
        }
        params.event.preventDefault(); // Prevenir comportamiento por defecto
      }
    },
  };
  onMasterSelectionChanged(event: any) {}

  onMasterCellValueChanged(event: any) {
    // Si cambió idFamilia, actualizar familiaDescription y filtrar subfamilias
    if (event.column.getColId() === 'idFamilia') {
      const familia = this.familiasCatalog.find(f => f.id === event.newValue);
      if (familia) {
        event.data.familiaDescription = familia.description;
      }
      // Filtrar subfamilias por la familia seleccionada
      this.filtrarSubfamiliasPorFamilia(event.newValue);
      // Limpiar subfamilia si no pertenece a la nueva familia
      const subfamiliaActual = this.subfamiliasFiltered.find(s => s.id === event.data.idSubfamilia);
      if (!subfamiliaActual) {
        event.data.idSubfamilia = this.subfamiliasFiltered.length > 0 ? this.subfamiliasFiltered[0].id : null;
        event.data.subfamiliaDescription = this.subfamiliasFiltered.length > 0 ? this.subfamiliasFiltered[0].description : '';
      }
      // Refrescar caché de columnas para actualizar dropdown de subfamilias
      this.refreshColumnCache();
    }

    // Si cambió idSubfamilia, actualizar subfamiliaDescription
    if (event.column.getColId() === 'idSubfamilia') {
      const subfamilia = this.subfamiliasFiltered.find(s => s.id === event.newValue);
      if (subfamilia) {
        event.data.subfamiliaDescription = subfamilia.description;
      }
    }

    event.data.__modified = true;
    this.notSavedChanges = true;

    // Refrescar la fila para actualizar el agrupamiento visual
    if (event.column.getColId() === 'idFamilia' || event.column.getColId() === 'idSubfamilia') {
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
    }
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onMasterRowSelected(event: any) {
    if (event.data && event.data.id) {
      this.id = event.data.id;
    }
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

    if (colId === 'picture' && selectedRowData.picture) {
      if (this.notSavedChanges) {
        alerts.basicAlert('Cambios sin guardar', 'Guarde los cambios antes de ver la imagen.', 'warning');
        return;
      }
      this.selectedImage = selectedRowData.picture;
      // Open modal using Bootstrap
      const modal = new (window as any).bootstrap.Modal(document.getElementById('imageModal'));
      modal.show();
      return;
    }

    this.notSavedChanges = true;


    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
    this.selectedRowData = selectedRowData;
  }
  async activateLoansTab() {
    if (!this.isOpen || this.showSavingsTab) {
      await this.adjustGridSize();
      this.showLoansTab = true;
      this.showSavingsTab = false;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async activateSavingsTab() {
    if (!this.isOpen || this.showLoansTab) {
      await this.adjustGridSize();
      this.showLoansTab = false;
      this.showSavingsTab = true;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
  }

  get colMaster(): ColDef[] {
    // Si ya tenemos columnas cacheadas, devolverlas para evitar re-renderizado
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    // Construir y cachear las columnas solo la primera vez
    this._colMaster = [
      {
        field: 'familiaDescription',
        headerName: 'Familia (Grupo)',
        rowGroup: true,
        hide: true,
      },
      {
        field: 'subfamiliaDescription',
        headerName: 'Subfamilia (Grupo)',
        rowGroup: true,
        hide: true,
      },
      {
        field: 'idFamilia',
        headerName: 'Familia',
        editable: true,
        width: 120,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: () => {
          return {
            options: [
              ...this.familiasCatalog.map(f => ({
                id: f.id,
                description: f.description,
                valueAddition: f.valueAddition || '',
                valueAddition2: f.valueAddition2 || ''
              })),
              {
                id: -999,
                description: '➕ Agregar nueva familia...',
                valueAddition: '-999',
                valueAddition2: '➕ Agregar nueva familia...'
              }
            ]
          };
        },
        onCellValueChanged: (event: any) => {
          if (event.newValue === -999) {
            // Usuario seleccionó "Agregar nueva familia"
            event.data.idFamilia = event.oldValue || null;
            this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
            this.familyModalService.openModal({ idCompany: this.idcompany });
          }
        },
        cellRenderer: (params: any) => {
          const value = params.value;
          if (value === -999) return '';
          const familia = this.familiasCatalog.find(f => f.id === value);
          const displayText = familia ? familia.description : (value || '');

          const container = document.createElement('div');
          container.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; cursor: pointer;';
          container.textContent = displayText;

          container.addEventListener('mouseenter', (e) => {
            if (familia) {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              this.showCellTooltip(familia, rect);
            }
          });

          container.addEventListener('mouseleave', () => {
            this.hideCellTooltip();
          });

          return container;
        },
      },
      {
        field: 'idSubfamilia',
        headerName: 'Subfamilia',
        editable: true,
        width: 120,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: (params: any) => {
          // Filtrar subfamilias según la familia seleccionada en la fila
          const idFamiliaSeleccionada = params.data.idFamilia;

          if (idFamiliaSeleccionada) {
            const subfamiliasFiltradas = this.subfamiliasCatalog
              .filter(s => s.parentId === idFamiliaSeleccionada)
              .map(s => ({
                id: s.id,
                description: s.description,
                valueAddition: s.valueAddition || '',
                valueAddition2: s.valueAddition2 || ''
              }));

            return {
              options: [
                ...subfamiliasFiltradas,
                {
                  id: -999,
                  description: '➕ Agregar nueva subfamilia...',
                  valueAddition: '-999',
                  valueAddition2: '➕ Agregar nueva subfamilia...'
                }
              ]
            };
          }

          return { options: [] };
        },
        onCellValueChanged: (event: any) => {
          if (event.newValue === -999) {
            // Usuario seleccionó "Agregar nueva subfamilia"
            const idFamilia = event.data.idFamilia;
            if (!idFamilia) {
              alerts.basicAlert('Error', 'Primero debe seleccionar una familia.', 'warning');
              return;
            }
            const familia = this.familiasCatalog.find(f => f.id === idFamilia);
            event.data.idSubfamilia = event.oldValue || null;
            this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
            this.subfamilyModalService.openModal({
              idCompany: this.idcompany,
              parentId: idFamilia,
              parentDescription: familia?.description || ''
            });
          }
        },
        cellRenderer: (params: any) => {
          const value = params.value;
          if (value === -999) return '';
          const subfamilia = this.subfamiliasCatalog.find(s => s.id === value);
          const displayText = subfamilia ? subfamilia.description : (value || '');

          const container = document.createElement('div');
          container.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; cursor: pointer;';
          container.textContent = displayText;

          container.addEventListener('mouseenter', (e) => {
            if (subfamilia) {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              this.showCellTooltip(subfamilia, rect);
            }
          });

          container.addEventListener('mouseleave', () => {
            this.hideCellTooltip();
          });

          return container;
        },
      },
      {
        field: 'insumo',
        headerName: 'Insumo',
        editable: true,
        width: 150,
      },
      {
        field: 'idMedida',
        headerName: 'Unidad',
        editable: true,
        width: 130,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: [
            ...this.unitsCatalog.map((u: any) => u.description),
            '➕ Agregar nueva unidad...'
          ]
        }),
        valueGetter: (params: any) => {
          if (!params.data?.idMedida) return '';
          const unit = this.unitsCatalog.find((u: any) => Number(u.id) === Number(params.data.idMedida));
          return unit ? unit.description : '';
        },
        valueSetter: (params: any) => {
          if (params.newValue === '➕ Agregar nueva unidad...') {
            setTimeout(() => this.measureModalService.openModal({ idCompany: this.idcompany }), 0);
            return false;
          }
          const unit = this.unitsCatalog.find((u: any) => u.description === params.newValue);
          if (unit) {
            params.data.idMedida = Number(unit.id);
            params.data.unidadDescription = unit.description;
            return true;
          }
          return false;
        },
      },
      {
        field: 'materialDescription',
        headerName: 'Descripción del Material',
        editable: true,
        width: 600,
        wrapText: true,
        autoHeight: true,
        cellStyle: { 'white-space': 'normal', 'line-height': '1.4', 'padding-top': '4px', 'padding-bottom': '4px' },
      },
      {
        field: 'barcode',
        headerName: 'Código de Barras',
        editable: true,
        width: 150,
        valueFormatter: (params: any) => (params.value === 'N/A' || params.value === 'n/a') ? '' : (params.value || ''),
      },

      {
        field: 'quantity',
        headerName: 'Cantidad',
        editable: true,
        width: 90,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        valueParser: (params: any) => Number(params.newValue),
        valueFormatter: (params: any) => params.value != null ? Number(params.value).toFixed(4) : '0.0000',
      },

          {
        headerName: 'Dist.',
        width: 60,
        editable: false,
        cellStyle: { textAlign: 'center', cursor: 'pointer' },
        cellRenderer: (params: any) => {
          const isNew = typeof params.data?.id === 'string';
          return isNew
            ? `<span style="color:#ccc;font-size:1rem;"><i class="bi bi-calendar3"></i></span>`
            : `<span title="Distribución" style="color:#0d6efd;font-size:1rem;"><i class="bi bi-calendar3"></i></span>`;
        },
        onCellClicked: (params: any) => {
          if (typeof params.data?.id === 'string') return;
          this.toggleDetail(params.node);
        },
      },

      {
        field: 'existencia',
        headerName: 'Existencia',
        editable: false,
        width: 100,
        valueGetter: () => 0,
      },
      {
        field: 'costoMN',
        headerName: 'Costo MN',
        editable: true,
        width: 100,
        valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : '$0.00',
      },
      {
        field: 'ventaMN',
        headerName: 'Venta MN',
        editable: true,
        width: 100,
        valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : '$0.00',
      },
      {
        field: 'stockMin',
        headerName: 'Stock Mínimo',
        editable: true,
        width: 120,
      },
      {
        field: 'stockMax',
        headerName: 'Stock Máximo',
        editable: true,
        width: 120,
      },

      {
        field: 'picture',
        headerName: 'Imagen',
        cellRenderer: (params: ICellRendererParams) => {
          if (params.value) {
            return `<img src="${params.value}" style="width: 50px; height: 50px; object-fit: cover;" />`;
          }
          return '';
        },
        width: 80,
      },
   
    ];

    return this._colMaster;
  }

  // Método para invalidar la caché de columnas (útil cuando cambian catálogos)
  refreshColumnCache(): void {
    this._colMaster = [];
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.colMaster);
    }
  }

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.showLoansTab = false;
    this.showSavingsTab = false;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  addMasterRow() {
    // Si hay una distribución abierta, cerrarla primero
    if (this.savedRowData) {
      this.rowData = [...this.savedRowData];
      this.savedRowData = null;
      this.gridApi?.setGridOption('rowData', this.rowData);
    }
    const tempId = `temp_${this.tempIdCounter++}`;

    // Obtener familia por defecto y filtrar subfamilias
    const defaultFamilia = this.familiasCatalog.length > 0 ? this.familiasCatalog[0] : null;
    if (defaultFamilia) {
      this.filtrarSubfamiliasPorFamilia(defaultFamilia.id);
      this.refreshColumnCache();
    }
    const defaultSubfamilia = this.subfamiliasFiltered.length > 0 ? this.subfamiliasFiltered[0] : null;

    const newItem = {
      id: tempId,
      idCompany: this.idcompany,
      insumo: '',
      materialDescription: '',
      idFamilia: defaultFamilia?.id || null,
      familiaDescription: defaultFamilia?.description || '',
      idSubfamilia: defaultSubfamilia?.id || null,
      subfamiliaDescription: defaultSubfamilia?.description || '',
      idMedida: null,
      barcode: '',
      picture: '',
      costoMN: 0,
      ventaMN: 0,
      typeMaterial: 'CONSUMABLE',
      stockMin: 1,
      stockMax: 30,
      quantity: 0,
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const firstRowIndex = 0;

      this.gridApi.ensureIndexVisible(firstRowIndex);

      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'insumo'
      });
    }, 0);
  }

  async saveMasterChanges() {
    /*const isValid = this.rowData.every(
      (item) => item.barCode && item.description && item.idMedida && item.date
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar los campos obligatorios antes de guardar.',
        'error'
      );
      return;
    }*/

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables: Promise<any>[] = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row, true); // isNew = true
      console.log('Nuevo material:', cleanedData);
      return lastValueFrom(this.materialsService.addMaterial(cleanedData));
    });

    const updateObservables: Promise<any>[] = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row, false); // isNew = false
      console.log('Actualizar material ID:', row.id, cleanedData);
      return lastValueFrom(this.materialsService.updateMaterial(row.id, cleanedData));
    });

    try {
      const allResponses = await Promise.all([
        ...addObservables,
        ...updateObservables,
      ]);

      //console.log('Promise.all completado. Respuestas:', allResponses);
      for (const response of allResponses) {
        // Verificar si es una nueva creación comparando con los IDs temporales
        const correspondingNewRow = newRows.find(
          (row) => !row.id || row.id.toString().startsWith('temp_')
        );

      }

      // Determinar qué ID vamos a seleccionar después de recargar
      if (modifiedRows.length > 0) {
        // Si hay filas modificadas, guardamos el ID de la última modificada
        this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
      } else if (newRows.length > 0) {
        // Si hay filas nuevas, marcaremos que necesitamos seleccionar el ID máximo
        this.lastEditedRowId = 'SELECT_MAX_ID';
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];

      await this.obtenerDatos(); // Esperar a que se actualicen los datos

      // Seleccionar la fila apropiada después de recargar
      if (this.lastEditedRowId) {
        if (this.lastEditedRowId === 'SELECT_MAX_ID') {
          // Encontrar el ID máximo en los datos actuales
          const maxId = Math.max(...this.rowData.map((row) => Number(row.id)));
          this.selectRowById(maxId);
        } else {
          this.selectRowById(this.lastEditedRowId);
        }
        this.lastEditedRowId = null; // Resetear el ID
      }
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  deleteMasterEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    console.log('Datos del empleado a eliminar:', selectedData);

    // Validar que el préstamo sea 0 o no exista
    /*if (selectedData.loan && selectedData.loan !== 0) {
      alerts.basicAlert(
        'Error al eliminar',
        'No se puede eliminar el empleado mientras tenga préstamos activos',
        'error'
      );
      return;
    }*/

    const id = selectedData.id;
    selectedData.active = 0;
    alerts
      .confirmAlert(
        'Eliminar un Material',
        '¿Está seguro que desea eliminar este material?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.materialsService
            .deleteMaterial(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar material',
                  'Error al eliminar el material.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Material eliminado',
                'El material se eliminó correctamente',
                'success'
              );
              this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Materiales', 'Menu Administracion Materiales',  this.trackingService.getEmail());
              this.obtenerDatos();
              this.notSavedChanges = false;
              this.selectedRowData = null;
            });
        }
      });
  }

  revertMasterData() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(),'Cancelar Salvar Registro en Materiales', 'Menu Administracion Materiales',  this.trackingService.getEmail());
  }

  private selectRowById(id: number | string) {
    // Dar tiempo al grid para que se actualice
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        // Convertir ambos IDs a número para la comparación
        const nodeId =
          typeof node.data.id === 'string'
            ? parseInt(node.data.id)
            : node.data.id;
        const searchId = typeof id === 'string' ? parseInt(id) : id;

        if (nodeId === searchId) {
          node.setSelected(true);
          this.gridApi.ensureNodeVisible(node, 'middle');
        }
      });
    }, 100);
  }

  onAdd() {
    this.addMasterRow();
  }

  onEdit() {
    this.saveMasterChanges();
  }

  onDelete() {
    this.deleteMasterEntry();
  }

  // ==================== TOOLTIP METHODS ====================

  private showCellTooltip(catalogItem: any, cellRect: DOMRect): void {
    this.hideCellTooltip();

    const description = catalogItem.valueAddition || 'NA';
    const abbreviation = catalogItem.valueAddition2 || 'NA';

    // Crear contenedor del tooltip
    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '10001');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipElement, 'min-width', '280px');
    this.renderer.setStyle(this.tooltipElement, 'max-width', '400px');

    // Crear flecha del tooltip
    const arrow = this.renderer.createElement('div');
    this.renderer.setStyle(arrow, 'position', 'absolute');
    this.renderer.setStyle(arrow, 'left', '-8px');
    this.renderer.setStyle(arrow, 'top', '20px');
    this.renderer.setStyle(arrow, 'width', '0');
    this.renderer.setStyle(arrow, 'height', '0');
    this.renderer.setStyle(arrow, 'border-top', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-bottom', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-right', '8px solid #1e40af');
    this.renderer.appendChild(this.tooltipElement, arrow);

    // Crear contenido del tooltip
    const content = this.renderer.createElement('div');
    this.renderer.setStyle(content, 'border-radius', '8px');
    this.renderer.setStyle(content, 'box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4)');
    this.renderer.setStyle(content, 'overflow', 'hidden');
    this.renderer.setStyle(content, 'border', '1px solid rgba(255, 255, 255, 0.1)');
    this.renderer.setStyle(content, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');

    // Header
    const header = this.renderer.createElement('div');
    this.renderer.setStyle(header, 'background', 'rgba(255, 255, 255, 0.15)');
    this.renderer.setStyle(header, 'padding', '10px 14px');
    this.renderer.setStyle(header, 'border-bottom', '1px solid rgba(255, 255, 255, 0.2)');
    this.renderer.setStyle(header, 'color', '#ffffff');
    this.renderer.setStyle(header, 'font-size', '13px');
    this.renderer.setStyle(header, 'display', 'flex');
    this.renderer.setStyle(header, 'align-items', 'center');
    this.renderer.setStyle(header, 'gap', '8px');
    this.renderer.setStyle(header, 'font-weight', '600');

    const headerIcon = this.renderer.createElement('i');
    this.renderer.addClass(headerIcon, 'bi');
    this.renderer.addClass(headerIcon, 'bi-info-circle');
    this.renderer.setStyle(headerIcon, 'font-size', '16px');
    this.renderer.appendChild(header, headerIcon);

    const headerText = this.renderer.createElement('strong');
    const headerTextNode = this.renderer.createText(catalogItem.description || '');
    this.renderer.appendChild(headerText, headerTextNode);
    this.renderer.appendChild(header, headerText);
    this.renderer.appendChild(content, header);

    // Body
    const body = this.renderer.createElement('div');
    this.renderer.setStyle(body, 'padding', '12px 14px');
    this.renderer.setStyle(body, 'color', '#e2e8f0');
    this.renderer.setStyle(body, 'font-size', '12px');

    // Descripción
    const descRow = this.renderer.createElement('div');
    this.renderer.setStyle(descRow, 'display', 'flex');
    this.renderer.setStyle(descRow, 'align-items', 'flex-start');
    this.renderer.setStyle(descRow, 'margin-bottom', '10px');
    this.renderer.setStyle(descRow, 'gap', '8px');

    const descLabel = this.renderer.createElement('span');
    this.renderer.setStyle(descLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(descLabel, 'font-weight', '600');
    this.renderer.setStyle(descLabel, 'min-width', '100px');
    this.renderer.setStyle(descLabel, 'display', 'flex');
    this.renderer.setStyle(descLabel, 'align-items', 'center');
    this.renderer.setStyle(descLabel, 'gap', '5px');
    this.renderer.setStyle(descLabel, 'flex-shrink', '0');

    const descIcon = this.renderer.createElement('i');
    this.renderer.addClass(descIcon, 'bi');
    this.renderer.addClass(descIcon, 'bi-pencil');
    this.renderer.setStyle(descIcon, 'font-size', '12px');
    this.renderer.appendChild(descLabel, descIcon);

    const descLabelText = this.renderer.createText('Descripción:');
    this.renderer.appendChild(descLabel, descLabelText);
    this.renderer.appendChild(descRow, descLabel);

    const descValue = this.renderer.createElement('span');
    this.renderer.setStyle(descValue, 'color', '#ffffff');
    this.renderer.setStyle(descValue, 'word-break', 'break-word');
    this.renderer.setStyle(descValue, 'line-height', '1.4');
    const descValueText = this.renderer.createText(description);
    this.renderer.appendChild(descValue, descValueText);
    this.renderer.appendChild(descRow, descValue);
    this.renderer.appendChild(body, descRow);

    // Abreviatura
    const abbrRow = this.renderer.createElement('div');
    this.renderer.setStyle(abbrRow, 'display', 'flex');
    this.renderer.setStyle(abbrRow, 'align-items', 'flex-start');
    this.renderer.setStyle(abbrRow, 'margin-bottom', '0');
    this.renderer.setStyle(abbrRow, 'gap', '8px');

    const abbrLabel = this.renderer.createElement('span');
    this.renderer.setStyle(abbrLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(abbrLabel, 'font-weight', '600');
    this.renderer.setStyle(abbrLabel, 'min-width', '100px');
    this.renderer.setStyle(abbrLabel, 'display', 'flex');
    this.renderer.setStyle(abbrLabel, 'align-items', 'center');
    this.renderer.setStyle(abbrLabel, 'gap', '5px');
    this.renderer.setStyle(abbrLabel, 'flex-shrink', '0');

    const abbrIcon = this.renderer.createElement('i');
    this.renderer.addClass(abbrIcon, 'bi');
    this.renderer.addClass(abbrIcon, 'bi-fonts');
    this.renderer.setStyle(abbrIcon, 'font-size', '12px');
    this.renderer.appendChild(abbrLabel, abbrIcon);

    const abbrLabelText = this.renderer.createText('Abreviatura:');
    this.renderer.appendChild(abbrLabel, abbrLabelText);
    this.renderer.appendChild(abbrRow, abbrLabel);

    const abbrValue = this.renderer.createElement('span');
    this.renderer.setStyle(abbrValue, 'color', '#ffffff');
    this.renderer.setStyle(abbrValue, 'word-break', 'break-word');
    this.renderer.setStyle(abbrValue, 'line-height', '1.4');
    const abbrValueText = this.renderer.createText(abbreviation);
    this.renderer.appendChild(abbrValue, abbrValueText);
    this.renderer.appendChild(abbrRow, abbrValue);
    this.renderer.appendChild(body, abbrRow);

    this.renderer.appendChild(content, body);
    this.renderer.appendChild(this.tooltipElement, content);

    // Agregar al body
    this.renderer.appendChild(document.body, this.tooltipElement);

    // Posicionar tooltip a la derecha de la celda
    const top = cellRect.top;
    const left = cellRect.right + 8;
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);

    // Animación de entrada
    this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.setStyle(this.tooltipElement, 'opacity', '1');
        this.renderer.setStyle(this.tooltipElement, 'transition', 'opacity 0.3s ease');
      }
    }, 10);
  }

  private hideCellTooltip(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  // ==================== CASCADA DISTRIBUCIÓN (full-width row) ====================

  toggleDetail(node: any) {
    if (!this.gridApi) return;

    // Si ya hay una distribución abierta para esta misma fila → cerrar
    const existing = this.rowData.find(r => r.__isDistDetail);
    if (existing && existing.__materialId === node.data.id) {
      this.collapseDetail();
      return;
    }

    // Si hay distribución de otra fila abierta → restaurar primero
    if (this.savedRowData) {
      this.rowData = [...this.savedRowData];
      this.savedRowData = null;
    }

    this.savedRowData = [...this.rowData];

    const distRow = {
      __isDistDetail: true,
      __materialId:   node.data.id,
      idCompany:      node.data.idCompany ?? this.idcompany,
      description:    node.data.materialDescription || node.data.description || '',
      unit:           node.data.unidadDescription || '',
      quantity:       Number(node.data.quantity || 0),
      id:             `__dist_${node.data.id}`,
    };

    const idx = this.rowData.findIndex(r => r.id === node.data.id);
    this.rowData = [
      this.rowData[idx],
      distRow,
    ];
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  collapseDetail() {
    if (!this.savedRowData || !this.gridApi) return;
    this.rowData = this.savedRowData;
    this.savedRowData = null;
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  // ==================== PDF REPORTE GENERAL ====================

  togglePdfReport() {
    this.showPdfReport = !this.showPdfReport;
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }

  // ==================== MÉTODOS PARA EL MODAL DE FAMILIA ====================

  openFamilyModal(idCompany: number) {
    this.newFamily = {
      idCompany: idCompany,
      description: '',
      valueAddition: 'NA',
      valueAdditionBit2: false,
      valueAdditionBit3: false,
      vigente: false,
      type: 'FAMILY',
      active: 1
    };
    this.showFamilyModal = true;
    document.body.classList.add('modal-open');
  }

  closeFamilyModal() {
    this.showFamilyModal = false;
    document.body.classList.remove('modal-open');
  }

  async saveNewFamily() {
    if (!this.newFamily.description) {
      alerts.basicAlert(
        'Error',
        'La descripción de la familia es obligatoria.',
        'error'
      );
      return;
    }

    try {
      const result: any = await lastValueFrom(
        this.catalogsService.addCatalog(this.newFamily)
      );

      alerts.basicAlert(
        'Familia creada',
        'La familia se ha creado correctamente.',
        'success'
      );

      // Notificar a través del servicio
      this.familyModalService.confirmSave({
        id: result.id,
        description: this.newFamily.description
      });

      this.closeFamilyModal();

    } catch (error: any) {
      alerts.basicAlert(
        'Error',
        `Error al crear la familia. ${error?.error?.message || error?.message || 'Error desconocido'}`,
        'error'
      );
    }
  }

  onFamilyCreated(familyData: { id: number; description: string }) {
    // Agregar inmediatamente al catálogo local para que cellRenderer lo encuentre
    this.familiasCatalog = [...this.familiasCatalog, { id: familyData.id, description: familyData.description }];
    this.refreshColumnCache();

    // Asignar a la fila seleccionada
    const selectedNodes = this.gridApi?.getSelectedNodes();
    if (selectedNodes && selectedNodes.length > 0) {
      const selectedRow = selectedNodes[0];
      selectedRow.setDataValue('idFamilia', familyData.id);
      selectedRow.setDataValue('familiaDescription', familyData.description);
      this.notSavedChanges = true;
    }

    if (this.gridApi) {
      this.gridApi.refreshCells({ columns: ['idFamilia'], force: true });
    }

    // Recargar lista completa en background
    this.obtenerFamilias();
  }

  // ==================== MÉTODOS PARA EL MODAL DE SUBFAMILIA ====================

  openSubfamilyModal(idCompany: number, parentId: number, parentDescription: string) {
    this.selectedParentFamilyDescription = parentDescription;
    this.newSubfamily = {
      idCompany: idCompany,
      description: '',
      valueAddition: 'NA',
      valueAdditionBit2: false,
      valueAdditionBit3: false,
      vigente: false,
      type: 'SUBFAMILY',
      parentId: parentId,
      active: 1
    };
    this.showSubfamilyModal = true;
    document.body.classList.add('modal-open');
  }

  closeSubfamilyModal() {
    this.showSubfamilyModal = false;
    document.body.classList.remove('modal-open');
  }

  async saveNewSubfamily() {
    if (!this.newSubfamily.description) {
      alerts.basicAlert(
        'Error',
        'La descripción de la subfamilia es obligatoria.',
        'error'
      );
      return;
    }

    try {
      const result: any = await lastValueFrom(
        this.catalogsService.addCatalog(this.newSubfamily)
      );

      alerts.basicAlert(
        'Subfamilia creada',
        'La subfamilia se ha creado correctamente.',
        'success'
      );

      // Notificar a través del servicio
      this.subfamilyModalService.confirmSave({
        id: result.id,
        description: this.newSubfamily.description,
        parentId: this.newSubfamily.parentId
      });

      this.closeSubfamilyModal();

    } catch (error: any) {
      alerts.basicAlert(
        'Error',
        `Error al crear la subfamilia. ${error?.error?.message || error?.message || 'Error desconocido'}`,
        'error'
      );
    }
  }

  onSubfamilyCreated(subfamilyData: { id: number; description: string; parentId: number }) {
    // Agregar inmediatamente al catálogo local para que cellRenderer lo encuentre
    this.subfamiliasCatalog = [...this.subfamiliasCatalog, { id: subfamilyData.id, description: subfamilyData.description, parentId: subfamilyData.parentId }];
    this.subfamiliasFiltered = [...this.subfamiliasFiltered, { id: subfamilyData.id, description: subfamilyData.description, parentId: subfamilyData.parentId }];
    this.refreshColumnCache();

    // Asignar a la fila seleccionada (si coincide la familia)
    const selectedNodes = this.gridApi?.getSelectedNodes();
    if (selectedNodes && selectedNodes.length > 0) {
      const selectedRow = selectedNodes[0];
      if (selectedRow.data.idFamilia === subfamilyData.parentId) {
        selectedRow.setDataValue('idSubfamilia', subfamilyData.id);
        selectedRow.setDataValue('subfamiliaDescription', subfamilyData.description);
        this.notSavedChanges = true;
      }
    }

    if (this.gridApi) {
      this.gridApi.refreshCells({ columns: ['idSubfamilia'], force: true });
    }

    // Recargar lista completa en background
    this.obtenerSubfamilias();
  }

  // ==================== MÉTODOS PARA EL MODAL DE UNIDAD ====================

  openMeasureModal(idCompany: number) {
    this.newMeasure = {
      idCompany: idCompany,
      description: '',
      valueAddition: 'NA',
      valueAdditionBit2: false,
      valueAdditionBit3: false,
      vigente: true,
      type: 'MEASURE',
      active: 1
    };
    this.showMeasureModal = true;
    document.body.classList.add('modal-open');
  }

  closeMeasureModal() {
    this.showMeasureModal = false;
    document.body.classList.remove('modal-open');
  }

  async saveNewMeasure() {
    if (!this.newMeasure.description) {
      alerts.basicAlert('Error', 'La descripción de la unidad es obligatoria.', 'error');
      return;
    }

    try {
      const result: any = await lastValueFrom(
        this.catalogsService.addCatalog(this.newMeasure)
      );

      alerts.basicAlert('Unidad creada', 'La unidad se ha creado correctamente.', 'success');

      this.measureModalService.confirmSave({
        id: result.id,
        description: this.newMeasure.description
      });

      this.closeMeasureModal();

    } catch (error: any) {
      alerts.basicAlert(
        'Error',
        `Error al crear la unidad. ${error?.error?.message || error?.message || 'Error desconocido'}`,
        'error'
      );
    }
  }

  onMeasureCreated(measureData: { id: number; description: string }) {
    // Agregar inmediatamente al catálogo local para que cellRenderer lo encuentre
    this.unitsCatalog = [...this.unitsCatalog, { id: measureData.id, description: measureData.description }];
    this.refreshColumnCache();

    // Asignar a la fila seleccionada
    const selectedNodes = this.gridApi?.getSelectedNodes();
    if (selectedNodes && selectedNodes.length > 0) {
      const selectedRow = selectedNodes[0];
      selectedRow.setDataValue('idMedida', measureData.id);
      this.notSavedChanges = true;
    }

    if (this.gridApi) {
      this.gridApi.refreshCells({ columns: ['idMedida'], force: true });
    }

    // Recargar lista completa en background
    this.obtenerUnidades();
  }
}