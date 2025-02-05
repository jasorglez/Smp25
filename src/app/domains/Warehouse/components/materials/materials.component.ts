import { Component, effect, HostListener, inject } from '@angular/core';
import { CellDoubleClickedEvent, ColDef, GetMainMenuItemsParams, GridApi, GridReadyEvent, ICellRendererParams, MenuItemDef } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
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
import { Router } from '@angular/router';
import { Icatalog } from 'app/interface/icatalog';

declare const bootstrap: any; // Añadir declaración para Bootstrap

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './materials.component.html',
  styleUrl: './materials.component.scss'
})
export class MaterialsComponent {

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerMedidas();
    this.obtenerFamilias();
    this.obtenerSubfamilias();
    this.obtenerUbicaciones();
  }

  constructor(private router: Router) {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerDatos();
      this.obtenerMedidas();
      this.obtenerFamilias();
      this.obtenerSubfamilias();
      this.obtenerUbicaciones();
    }
    )
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  newFamilyName: string = '';
  newLocationName: string = '';
  newSubFamilyName: string = '';
  selectedFamily: number = null;
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  private estados: string[] = [];
  medidas: any;
  parentId: number = 200;
  familias: any;
  subfamilias2: any;
  ubicaciones: any;
  id: string = null;
  idRoot: number = null;
  private tempIdCounter: number = 0;
  material = {
    picture: null as string,
    description: null as string,
    measure: null as string
  }

  private gridApi: GridApi;

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent
  };

  // Inject of new way for Angular 18
  private materialsService = inject(MaterialsService);
  private catalogsService = inject(CatalogsService);
  private modalServiceTable = inject(ModalService);
  private imageHandlerService = inject(ImageHandlerService);
  private signalsService = inject(SignalsService);

  // Column Definitions: Defines the columns to be displayed.
  get colMaster(): ColDef[] {
    return [
      { field: 'insumo', headerName: 'Número Material', editable: true, filter: true, width: 150 },
      { field: 'articulo', headerName: 'Artículo', editable: true, filter: true, width: 150 },
      {
        field: 'description', headerName: 'Descripción', editable: false, width: 285, filter: true,
        cellEditor: 'agPopupTextCellEditor',
        cellEditorParams: {
          maxLength: 100,
          cols: 50,
          rows: 3,
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.stopPropagation();
            }
          },
        },
        onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
          if (!event.node.group) {
            this.modalServiceTable.showModal({
              params: event,
              value: event.value,
            });
          }
        },
        cellRenderer: (params: ICellRendererParams) => {
          if (params.node.group) {
            return params.value;
          }
          return params.value;
        }
      },
      {
        field: 'date',
        headerName: 'Fecha',
        editable: true,
        width: 150,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'idMedida', headerName: 'Medidas', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.medidas ? this.medidas.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.medidas ? this.medidas.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.description}` : params.value;
        }
      },
      {
        field: 'idFamilia', headerName: 'Familia', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.familias ? this.familias.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.familias ? this.familias.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
        mainMenuItems: (params: GetMainMenuItemsParams) => {
          const familyMenuItems: (MenuItemDef | string)[] = [
            {
              name: "Añadir familia",
              action: () => {
                this.openAddFamilyModal();
              },
            },
            'separator',
            ...params.defaultItems.slice(0)
          ];
          return familyMenuItems;
        }
      },
      {
        field: 'idSubfamilia',
        headerName: 'Subfamilia',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        mainMenuItems: (params: GetMainMenuItemsParams) => {
          const subFamilyMenuItems: (MenuItemDef | string)[] = [
            {
              name: "Añadir subfamilia",
              action: () => {
                this.openAddSubFamilyModal();
              },
            },
            'separator',
            ...params.defaultItems.slice(0)
          ];
          return subFamilyMenuItems;
        },
        cellEditorParams: (params) => {
          // Obtener el idFamilia de la fila actual
          const idFamilia = params.data.idFamilia;

          // Filtrar subfamilias por parentId (idFamilia) usando subfamilias2
          const subfamiliasFiltradas = this.subfamilias2.filter(item => item.parentId === idFamilia);

          return {
            values: subfamiliasFiltradas.map(item => item.id),
            valueFormatter: (id) => {
              const foundItem = subfamiliasFiltradas.find(item => item.id === id);
              return foundItem ? foundItem.description : id;
            }
          };
        },
        valueFormatter: (params) => {
          // Mostrar la descripción de la subfamilia usando subfamilias2
          const foundItem = this.subfamilias2 ? this.subfamilias2.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.description}` : params.value;
        }
      },
      {
        field: 'idUbication', headerName: 'Ubicación', editable: true, width: 150, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.ubicaciones ? this.ubicaciones.map(item => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.ubicaciones ? this.ubicaciones.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
        mainMenuItems: (params: GetMainMenuItemsParams) => {
          const locationMenuItems: (MenuItemDef | string)[] = [
            {
              name: "Añadir ubicación",
              action: () => {
                this.openAddLocationModal();
              },
            },
            'separator',
            ...params.defaultItems.slice(0)
          ];
          return locationMenuItems;
        }
      },
      { field: 'aplicaResg', headerName: 'Resguardar', editable: true, width: 100 },
      {
        field: 'picture', headerName: 'Imagen', editable: false, width: 150,
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture'
        },
      },
      {
        field: 'costoMN', headerName: 'Costo MXN', editable: true, width: 150,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
        }
      },
      {
        field: 'costoDLL', headerName: 'Costo DLL', editable: true, width: 150,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(params.value);
        }
      },
      {
        field: 'ventaMN', headerName: 'Costo MXN', editable: true, width: 150,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
        }
      },
      {
        field: 'ventaDLL', headerName: 'Costo DLL', editable: true, width: 150,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(params.value);
        }
      },
      { field: 'stockMin', headerName: 'Stock Mínimo', editable: true, width: 150, cellDataType: 'number', cellEditorParams: { min: 0 } },
      { field: 'stockMax', headerName: 'Stock Máximo', editable: true, width: 150, cellDataType: 'number', cellEditorParams: { min: 0 } },
    ]
  };

  obtenerDatos() {
    this.materialsService.getMaterials(this.idRoot).subscribe((data: any) => {
      this.rowData = data;
    });
  }

  obtenerMedidas() {
    this.catalogsService.getMeasures().subscribe(
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
    this.catalogsService.getSubfamilies().subscribe(
      (data: Icatalog[]) => {
        this.subfamilias2 = data;
      },
      (error) => console.error('Error fetching subfamilies:', error)
    );
  }

  obtenerUbicaciones() {
    this.catalogsService.getLocations().subscribe(
      (data: Icatalog[]) => {
        this.ubicaciones = data;
      },
      (error) => console.error('Error fetching locations:', error)
    );
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
      const foundMeasure = this.medidas.find(item => item.id === this.selectedRowData.idMedida);
      this.material.measure = foundMeasure ? foundMeasure.description : '';
      this.material.picture = this.selectedRowData.picture;
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;

    if (event.data.idMedida) {
      event.data.idMedida = Number(event.data.idMedida);
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
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
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.insumo && item.description);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

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

    // Using concat to combine observables and lastValueFrom for async/await
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
      this.obtenerDatos(); // Refrescar los datos
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
    this.materialsService.deleteMaterial(id).pipe(
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
      .subscribe(
        () => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.obtenerDatos();

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.notSavedChanges = false;
          this.selectedRowData = null;
        }
      );
  }

  revert() {
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

  // Métodos para abrir el modal de Añadir Familia
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
      this.catalogsService.addCatalog({
        id: 0,
        idCompany: this.idRoot,
        description: this.newFamilyName,
        type: 'FAMILY'
      }).subscribe(
        (response) => {
          alerts.basicAlert('Éxito', 'Familia añadida correctamente', 'success');
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
      this.catalogsService.addCatalog({
        id: 0,
        description: this.newSubFamilyName,
        parentId: this.selectedFamily,
        type: 'SUBFAMILY'
      }).subscribe(
        (response) => {
          alerts.basicAlert('Éxito', 'Subfamilia añadida correctamente', 'success');
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
      idRoot: this.idRoot
    });
    
    if (this.newLocationName) {
      this.catalogsService.addCatalog({
        id: 0,
        idCompany: this.idRoot,
        description: this.newLocationName,
        type: 'UBICATION'
      }).subscribe(
        (response) => {
          console.log('Respuesta del servidor:', response);
          alerts.basicAlert('Éxito', 'Ubicación añadida correctamente', 'success');
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
          alerts.basicAlert('Error', 'No se pudo añadir la ubicación', 'error');
        }
      );
    }
  }
}
