import { Component, effect, HostListener, inject, signal, Directive } from '@angular/core';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import {
  CellDoubleClickedEvent,
  ColDef,
  GetMainMenuItemsParams,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  MenuItemDef,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ModalService } from 'app/services/modal.service';
import { MaterialsService } from 'app/services/materials.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { SignalsService } from 'app/services/signals.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Icatalog } from 'app/interface/icatalog';
import { ProvedoorByBranchComponent } from '../components/ProvedoorByBranch/ProvedoorByBranch.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { PricePresentations } from 'app/interface/materials.interface';
import { BranchsService } from 'app/services/branchs.service';
import { CustomersService } from 'app/services/customers.service';
import { PriceProductsPresentationsComponent } from '../components/price-products-presentations/price-products-presentations.component';
import { DetailCellRendererHistoricoComponent } from '../details/detail-cell-renderer-historico.component';
import { DetailCellRendererMaterialesComponent } from '../details/detail-cell-renderer-materiales.component';
import { DetailCellRendererParametrosComponent } from '../details/detail-cell-renderer-parametros.component';
import { TrackingService } from 'app/services/tracking.service';

declare const bootstrap: any;

@Directive()
export abstract class MaterialsBaseComponent implements CanComponentDeactivate {
  private trackingService = inject(TrackingService);
  // Abstract methods to be implemented by child components
  abstract getColumnDefs(): ColDef[];
  abstract getGridOptions(): any;
  abstract getType(): string;

  // Common properties
  type: string = '';
  notSavedChanges: boolean = false;
  newFamilyName: string = '';
  newLocationName: string = '';
  newSubFamilyName: string = '';
  selectedFamily: number = null;
  rowData: any[] = [];
  proveedoresData: any[] = [];
  public priceXproductsData = signal<PricePresentations[]>([]);
  public idMaterial = signal<number>(0);
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  private estados: string[] = [];
  medidas: any;
  parentId: number = 200;
  familias: any;
  subfamilias2: any;
  branchs: any[] = [];
  branchSelect: number;
  ubicaciones: any;
  id: string = null;
  idRoot: number = null;
  gridHeight: string = '80vh';
  showContainerTabs: boolean = false;
  showContainerTabsProveedoresByBranch: boolean = false;
  showMeasureTab: boolean = false;
  showSavingsTab: boolean = false;
  private isOpen: boolean = false;
  private tempIdCounter: number = 0;
  material = {
    picture: null as string,
    description: null as string,
    measure: null as string,
  };

  protected gridApi: GridApi;

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    detailCellRendererHistorico: DetailCellRendererHistoricoComponent,
    detailCellRendererMateriales: DetailCellRendererMaterialesComponent,
    detailCellRendererParametros: DetailCellRendererParametrosComponent,
  };

  // Injected services
  protected customerService = inject(CustomersService);
  protected materialsService = inject(MaterialsService);
  protected catalogsService = inject(CatalogsService);
  protected modalServiceTable = inject(ModalService);
  protected branchesService = inject(BranchsService);
  protected imageHandlerService = inject(ImageHandlerService);
  protected signalsService = inject(SignalsService);
  protected route = inject(ActivatedRoute);
  protected router = inject(Router);

  constructor() {
    this.type = this.getType();

    this.route.data.subscribe((data) => {
      this.type = data['type'] || this.getType();
    });

    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerDatos();
      this.obtenerMedidas();
      this.obtenerFamilias();
      this.obtenerSubfamilias();
      this.obtenerBranchs();
      this.obtenerProveedores();
      this.obtenerUbicaciones();
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  // Getter for column definitions that uses the abstract method
  get colMaster(): ColDef[] {
    return this.getColumnDefs();
  }

  // Getter for grid options that uses the abstract method
  get gridOptions(): any {
    return this.getGridOptions();
  }

  obtenerDatos(): any {
    // To be overridden by child classes if needed
    return this.materialsService.getMaterials(this.idRoot, this.type).subscribe(
      (data: any) => {
        this.rowData = data;
        console.log(this.rowData);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerMedidas() {
    this.catalogsService.getCatalogs(this.idRoot, 'MEASURE').subscribe(
      (data: Icatalog[]) => {
        this.medidas = data;
      },
      (error) => console.error('Error fetching measures:', error)
    );
  }

  obtenerFamilias() {
    this.catalogsService.getFamilyById(this.idRoot).subscribe(
      (data: Icatalog[]) => {
        this.familias = data;
      },
      (error) => console.error('Error fetching families:', error)
    );
  }

  obtenerSubfamilias() {
    this.catalogsService.getCatalogs(this.idRoot, 'SUBFAMILY').subscribe(
      (data: Icatalog[]) => {
        this.subfamilias2 = data;
      },
      (error) => console.error('Error fetching subfamilies:', error)
    );
  }

  obtenerBranchs() {
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerUbicaciones() {
    this.catalogsService.getCatalogs(this.idRoot, 'UBICATION').subscribe(
      (data: Icatalog[]) => {
        this.ubicaciones = data;
      },
      (error) => console.error('Error fetching locations:', error)
    );
  }

  obtenerProveedores() {
    return new Promise((resolve) => {
      this.customerService
        .getCustomers(this.branchSelect, this.type)
        .subscribe({
          next: (data: any) => {
            this.proveedoresData = data;
            resolve(true);
          },
          error: (error) => {
            console.error('Error obteniendo datos:', error);
            resolve(false);
          }
        });
    });
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.selectedFamily = this.selectedRowData.idFamilia;
      this.material.description = this.selectedRowData.description;
      const foundMeasure = this.medidas.find(
        (item) => item.id === this.selectedRowData.idMedida
      );
      this.material.measure = foundMeasure ? foundMeasure.description : '';
      this.material.picture = this.selectedRowData.picture;
    } else {
      this.selectedRowData = null;
    }
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    const colId = event.column.getColId();
    const selectedRowData = event.data;
    const selectedId = selectedRowData.id;

    this.notSavedChanges = true;

    if (colId === 'insumo') {
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };

      this.priceXproductsData.set(selectedRowData.pricePresentations);
      this.idMaterial.set(selectedRowData.id);
      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
      this.activatedTabs();
    }
    if (colId === 'idProveedor') {
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };
      this.signalsService.setIdMaterial(selectedId);
      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
      this.activatedTabsProveedoresByBranch();
    }

    this.selectedRowData = selectedRowData;
  }

  async selectTab(tab: string) {
    await this.activateMeasureTab();
  }

  async activatedTabs() {
    if (!this.isOpen) {
      await this.adjustGridSize();
      this.activateMeasureTab();
      this.showContainerTabs = true;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
      this.showMeasureTab = false;
      this.showContainerTabs = false;
    }
  }

  async activatedTabsProveedoresByBranch() {
    if (!this.isOpen) {
      await this.adjustGridSize();
      this.activateMeasureTab();
      this.showContainerTabsProveedoresByBranch = true;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
      this.showMeasureTab = false;
      this.showContainerTabsProveedoresByBranch = false;
    }
  }

  async activateMeasureTab() {
    if (!this.isOpen || this.showSavingsTab) {
      await this.adjustGridSize();
      this.showMeasureTab = true;
    }
  }

  async adjustGridSize() {
    this.gridHeight = '25vh';
  }

  resetGridSize() {
    this.gridHeight = '80vh';
    this.showMeasureTab = false;
    this.showSavingsTab = false;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onCellClicked(event: any): void {
    // Can be overridden by child classes
  }

  addRow() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo materials base', 'Almacenes', this.trackingService.getEmail());
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: 1,
      insumo: '',
      articulo: '',
      description: '',
      date: new Date().toISOString(),
      idMedida: null,
      idFamilia: null,
      idSubfamilia: null,
      idUbication: null,
      aplicaResg: false,
      picture: '',
      costoMN: 0,
      costoDLL: 0,
      ventaMN: 0,
      ventaDLL: 0,
      stockMin: 0,
      stockMax: 0,
      vigente: true,
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
        colKey: 'description'
      });
    }, 0);
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en materials base', 'Almacenes', this.trackingService.getEmail());
    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.materialsService.addMaterial(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.materialsService.updateMaterial(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteEntry() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó materials base', 'Almacenes', this.trackingService.getEmail());
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
    selectedData.active = 0;
    this.materialsService
      .deleteMaterial(id)
      .pipe(
        catchError((error) => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Error al eliminar la entrada.',
            'error'
          );
          console.error(error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.obtenerDatos();
        this.notSavedChanges = false;
        this.selectedRowData = null;
      });
  }

  revert() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en materials base', 'Almacenes', this.trackingService.getEmail());
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  refresh() {
    this.obtenerFamilias();
    this.obtenerSubfamilias();
  }

  openAddFamilyModal() {
    const modal = document.getElementById('addFamilyModal');
    if (modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  openAddSubFamilyModal() {
    const modal = document.getElementById('addSubFamilyModal');
    if (modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  openAddLocationModal() {
    const modal = document.getElementById('addLocationModal');
    if (modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  onSubmitFamily() {
    if (this.newFamilyName) {
      this.catalogsService
        .addCatalog({
          id: 0,
          idCompany: this.idRoot,
          description: this.newFamilyName,
          type: 'FAMILY',
        })
        .subscribe(
          (response) => {
            alerts.basicAlert(
              'Éxito',
              'Familia añadida correctamente',
              'success'
            );
            this.obtenerFamilias();

            if (response.catalog.type === 'FAMILY' && this.selectedRowData) {
              this.selectedRowData.idFamilia = response.id;
              this.notSavedChanges = true;
            }

            const modal = document.getElementById('addFamilyModal');
            if (modal) {
              const bootstrapModal = bootstrap.Modal.getInstance(modal);
              bootstrapModal.hide();
            }
            this.newFamilyName = '';
          },
          (error) => {
            alerts.basicAlert('Error', 'No se pudo añadir la familia', 'error');
            console.error(error);
          }
        );
    }
  }

  onSubmitSubFamily() {
    if (this.newSubFamilyName && this.selectedFamily) {
      this.catalogsService
        .addCatalog({
          id: 0,
          description: this.newSubFamilyName,
          parentId: this.selectedFamily,
          type: 'SUBFAMILY',
        })
        .subscribe(
          (response) => {
            alerts.basicAlert(
              'Éxito',
              'Subfamilia añadida correctamente',
              'success'
            );
            this.obtenerSubfamilias();

            if (response.catalog.type === 'SUBFAMILY' && this.selectedRowData) {
              this.selectedRowData.idSubfamilia = response.id;
              this.notSavedChanges = true;
            }

            const modal = document.getElementById('addSubFamilyModal');
            if (modal) {
              const bootstrapModal = bootstrap.Modal.getInstance(modal);
              bootstrapModal.hide();
            }
            this.newSubFamilyName = '';
          },
          (error) => {
            alerts.basicAlert('Error', 'No se pudo añadir la familia', 'error');
            console.error(error);
          }
        );
    }
  }

  onSubmitLocation() {
    console.log('Intentando enviar ubicación:', {
      name: this.newLocationName,
      idRoot: this.idRoot,
    });

    if (this.newLocationName) {
      this.catalogsService
        .addCatalog({
          id: 0,
          idCompany: this.idRoot,
          description: this.newLocationName,
          type: 'UBICATION',
        })
        .subscribe(
          (response) => {
            console.log('Respuesta del servidor:', response);
            alerts.basicAlert(
              'Éxito',
              'Ubicación añadida correctamente',
              'success'
            );
            this.obtenerUbicaciones();

            if (this.selectedRowData) {
              this.selectedRowData.idUbication = response.id;
              this.notSavedChanges = true;
            }

            const modal = document.getElementById('addLocationModal');
            if (modal) {
              const bootstrapModal = bootstrap.Modal.getInstance(modal);
              bootstrapModal.hide();
            }
            this.newLocationName = '';
          },
          (error) => {
            console.error('Error al añadir ubicación:', error);
            alerts.basicAlert(
              'Error',
              'No se pudo añadir la ubicación',
              'error'
            );
          }
        );
    }
  }

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
