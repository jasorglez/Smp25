import {
  Component,
  effect,
  HostListener,
  inject,
  Renderer2,
  RendererFactory2,
} from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule } from 'ag-grid-angular';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-enterprise';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { TrackingService } from 'app/services/tracking.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { CommonModule } from '@angular/common';
import { FamilyModalService } from './services/family-modal.service';
import { SubfamilyModalService } from './services/subfamily-modal.service';
import { MeasureModalService } from './services/measure-modal.service';
import { PdfMaterialsDistributionComponent } from './pdf-materials-distribution.component';

@Component({
  selector: 'storeComponent',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, PdfMaterialsDistributionComponent],
  templateUrl: './materials.component.html',
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
  private catalogsService = inject(CatalogsService);
  private familyModalService = inject(FamilyModalService);
  private subfamilyModalService = inject(SubfamilyModalService);
  private measureModalService = inject(MeasureModalService);
  private isOpen: boolean = false;

  showPdfReport: boolean = false;
  showPdfMoneyReport: boolean = false;

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

  components = {};

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: false,
    flex: 1,
  };
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
  obtenerDatos(): void {
    this.rowData = [];
    this._colMaster = [];
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.setGridOption('columnDefs', this.colMaster);
    }
  }

  public gridOptions: any = {
    stopEditingWhenCellsLoseFocus: false,
    headerHeight: 40,
    rowHeight: 32,
    suppressDragLeaveHidesColumns: true,
    rowBuffer: 10,
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
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onMasterRowSelected(event: any) {
    if (event.data && event.data.id) {
      this.id = event.data.id;
    }
  }

  async onCellDoubleClicked(_event: CellDoubleClickedEvent): Promise<void> {
    /* Vista solo frontend: sin acciones extra al doble clic */
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
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'producto',
        headerName: 'Producto',
        editable: true,
        flex: 2,
        minWidth: 200,
      },
      {
        field: 'costo',
        headerName: 'Costo',
        editable: true,
        flex: 1,
        minWidth: 120,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        valueParser: (params: any) => {
          const v = parseFloat(String(params.newValue).replace(/,/g, ''));
          return Number.isFinite(v) ? v : 0;
        },
        valueFormatter: (p: any) =>
          p.value != null && p.value !== ''
            ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(p.value))
            : '',
      },
      {
        field: 'venta',
        headerName: 'Venta',
        editable: true,
        flex: 1,
        minWidth: 120,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        valueParser: (params: any) => {
          const v = parseFloat(String(params.newValue).replace(/,/g, ''));
          return Number.isFinite(v) ? v : 0;
        },
        valueFormatter: (p: any) =>
          p.value != null && p.value !== ''
            ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(p.value))
            : '',
      },
      {
        field: 'impuesto',
        headerName: 'Impuesto',
        editable: true,
        flex: 1,
        minWidth: 120,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        valueParser: (params: any) => {
          const v = parseFloat(String(params.newValue).replace(/,/g, ''));
          return Number.isFinite(v) ? v : 0;
        },
        valueFormatter: (p: any) =>
          p.value != null && p.value !== ''
            ? `${Number(p.value).toFixed(2)} %`
            : '',
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
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idcompany,
      producto: '',
      costo: 0,
      venta: 0,
      impuesto: 0,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      this.gridApi.ensureIndexVisible(0);
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'producto',
      });
    }, 0);
  }

  async saveMasterChanges() {
    this.rowData.forEach((row) => {
      delete row.__isNew;
      delete row.__modified;
    });
    this.notSavedChanges = false;
    this.newlyAddedRows = [];
    alerts.basicAlert(
      'Vista previa',
      'Los datos solo están en pantalla. La persistencia en servidor se conectará después.',
      'info'
    );
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Guardar (solo frontend) — Materiales',
      'Menu Proyectos Materiales',
      this.trackingService.getEmail()
    );
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
    const id = selectedData.id;
    alerts
      .confirmAlert(
        'Eliminar fila',
        '¿Está seguro que desea eliminar esta fila?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.rowData = this.rowData.filter((r) => r.id !== id);
          this.gridApi.setGridOption('rowData', this.rowData);
          this.notSavedChanges = false;
          this.selectedRowData = null;
          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            'Eliminar fila (solo frontend) — Materiales',
            'Menu Proyectos Materiales',
            this.trackingService.getEmail()
          );
        }
      });
  }

  revertMasterData() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(),'Cancelar Salvar Registro en Materiales', 'Menu Administracion Materiales',  this.trackingService.getEmail());
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
    this.familiasCatalog = [...this.familiasCatalog, { id: familyData.id, description: familyData.description }];
    this.obtenerFamilias();
  }

  /** Catálogos para modales (la grilla ya no usa familias/subfamilias). */
  obtenerFamilias(): void {
    if (!this.idcompany) return;
    this.catalogsService.getCatalogs(this.idcompany, 'FAMILY').subscribe({
      next: (data: any) => {
        this.familiasCatalog = data;
      },
      error: (e) => console.error('Error fetching familias:', e),
    });
  }

  obtenerSubfamilias(): void {
    if (!this.idcompany) return;
    this.catalogsService.getCatalogs(this.idcompany, 'SUBFAMILY').subscribe({
      next: (data: any) => {
        this.subfamiliasCatalog = data;
        this.subfamiliasFiltered = data;
      },
      error: (e) => console.error('Error fetching subfamilias:', e),
    });
  }

  obtenerUnidades(): void {
    if (!this.idcompany) return;
    this.catalogsService.getUnits(this.idcompany).subscribe({
      next: (data: any) => {
        this.unitsCatalog = data;
      },
      error: (e) => console.error('Error fetching units:', e),
    });
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
    this.subfamiliasCatalog = [
      ...this.subfamiliasCatalog,
      {
        id: subfamilyData.id,
        description: subfamilyData.description,
        parentId: subfamilyData.parentId,
      },
    ];
    this.subfamiliasFiltered = [...this.subfamiliasFiltered];
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
    this.unitsCatalog = [...this.unitsCatalog, { id: measureData.id, description: measureData.description }];
    this.obtenerUnidades();
  }
}
