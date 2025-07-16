import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  GetMainMenuItemsParams,
  MenuItemDef,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { FormsModule } from '@angular/forms';
import { BranchsService } from 'app/services/branchs.service';
import { alerts } from 'app/helpers/alerts';
import { ModalService } from 'app/services/modal.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { InegiService } from 'app/services/inegi.service';
import { States } from 'app/interface/states';
import { Icatalog } from 'app/interface/icatalog';
import { environment } from '@env/environment';
import { Ibranch } from 'app/interface/ibranch';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { CatalogsService } from 'app/services/catalogs.service';
import { MaterialsService } from 'app/services/materials.service';
import { CustomersService } from 'app/services/customers.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
declare const bootstrap: any;

@Component({
  selector: 'app-detail-materials',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './detailMaterials.component.html',
})
export class DetailMaterialsComponent {
  private signalsService = inject(SignalsService);
  private branchesService = inject(BranchsService);
  private modalServiceTable = inject(ModalService);
  private inegiService = inject(InegiService);
  private customerService = inject(CustomersService);
  private materialsService = inject(MaterialsService);
  private catalogsService = inject(CatalogsService);
  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent
    
  }

  //Variables master
  masterRowData: any[] = [];
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];
  masterNotSavedChanges: boolean = false;
  idRoot: number = null;
  idUser: number = null;
  gridHeight: string = '85vh';
  branchs: any[] = [];
  branchSelect: number;
  proveedoresData: any[] = [];
  materialsData: any[] = [];
  familias: any;
  subfamilias2: any;
  //idRoot = this.signalsService.getRootSelectedBySidebar(); // Asignar directamente la Signal

  id: number = null;
  private masterGridApi: GridApi;
  private tempIdCounter: number = 0;
  private estados: any;

  // Configuración Grid
  public rowSelection: 'single' | 'multiple' = 'single';

  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';

  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idUser = this.signalsService.getIdUSer()();
      this.obtenerDatos();
      this.obtenerBranchs();
      this.obtenerProveedores();
      this.obtenerMateriaPrima();
      this.obtenerFamilias();
      this.obtenerSubfamilias();
    });
  }

  ngOnInit() {
    this.idUser = this.signalsService.getIdUSer()();
    this.obtenerDatos();
    this.obtenerBranchs();
    this.obtenerProveedores();
    this.obtenerMateriaPrima();
    this.obtenerFamilias();
    this.obtenerSubfamilias();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.masterNotSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  // ==================== MASTER METHODS ====================
  obtenerDatos(){

  }

  obtenerMateriaPrima() {
    return this.materialsService.getMaterials(this.idRoot, "CONSUMABLE").subscribe(
      (data: any) => {
        this.materialsData = data;
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
  obtenerProveedores() {
    return new Promise((resolve) => {
      this.customerService
        .getCustomers(this.branchSelect, "CUSTOMERS")
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
   obtenerBranchs() {
    // alert('this.branchs'+ this.idBranch)
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
      },
      (error) => console.error('Error fetching data:', error)
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
  
  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    rowClass: (params) => {
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
        this.masterGridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  get colMaster(): ColDef[] {
    return [
      { field: 'vigente', headerName: 'Activo', editable: true, width: 100 },
      {
        field: 'idBranch',
        headerName: 'Sucursal',
        headerClass: 'required-header',             
        editable: true,
        filter: true,
        width: 170,
        cellEditor: 'agSelectCellEditor',
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'windows',
        },

        cellEditorParams: (params) => {
          return {
            values: this.branchs
              ? this.branchs
                  .slice() // Creamos una copia para no modificar el array original
                  .sort((a, b) => a.name.localeCompare(b.name)) // Ordenamos por nombre
                  .map((item) => item.id) // Extraemos solo los IDs
              : [],
          };
        },

        valueFormatter: (params) => {
          // Handle potential null values and properly format the displayed value
          if (!params.value) return '';

          const foundBranch = this.branchs
            ? this.branchs.find((item) => item.id === params.value)
            : null;

          return foundBranch ? foundBranch.name : params.value;
        },
        valueGetter: (params) => {
          if (!params.data || !params.data.idBranch) return '';
          const branch = this.branchs?.find(b => b.id === params.data.idBranch);
          return branch ? branch.name : '';
        },
      },
      {
        field: 'idProveedor',
        headerName: 'Proveedor',
        editable: true,
        filter: true,
        cellEditor: 'autocompleteEditor',
        width: 200,
        cellEditorParams: {
          filterList: this.proveedoresData?.map(e => e.nameContact
          ),
          filterKey: 'nameContact',
          placeholder: 'Proveedor',
          minLength: 1
        },
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        valueSetter: (params) => {
          const rawValue = params.newValue;
          if (!rawValue || typeof rawValue !== 'string') {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }

          const normalizedValue = rawValue.trim().toUpperCase();

          if (!normalizedValue) {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }

          /*const duplicateExists = this.proveedoresData.some(
            (row, index) =>
              index !== params.node.rowIndex &&
              row.nameContact?.toUpperCase() === normalizedValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              'Ya existe un nombre de contacto registrado.',
              'error'
            );
            return false;
          }*/

          params.data[params.colDef.field] = normalizedValue;
          return true;
        },
      },
      {
        field: 'idProdsale',
        headerName: 'Materiales',
        editable: true,
        filter: true,
        cellEditor: 'autocompleteEditor',
        width: 200,
        cellEditorParams: {
          filterList: this.materialsData?.map(e => e.description
          ),
          filterKey: 'description',
          placeholder: 'Materiales',
          minLength: 1
        },
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },
        valueSetter: (params) => {
          const rawValue = params.newValue;
          if (!rawValue || typeof rawValue !== 'string') {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }

          const normalizedValue = rawValue.trim().toUpperCase();

          if (!normalizedValue) {
            alerts.basicAlert('Campo requerido', 'El nombre es obligatorio', 'error');
            return false;
          }

          /*const duplicateExists = this.proveedoresData.some(
            (row, index) =>
              index !== params.node.rowIndex &&
              row.nameContact?.toUpperCase() === normalizedValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              'Ya existe un nombre de contacto registrado.',
              'error'
            );
            return false;
          }*/

          params.data[params.colDef.field] = normalizedValue;
          return true;
        },
      },
      /*{
        field: 'idFamilia',
        headerName: 'Producto',
        editable: true,
        width: 150,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.familias ? this.familias.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.familias
            ? this.familias.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
        valueGetter: (params) => {
          console.log(params)
          if (!params.data || !params.data.idFamilia) return '';
          const familias = this.familias?.find(b => b.id === params.data.idFamilia);
        
          return familias ? familias.description : '';
        },
        mainMenuItems: (params: GetMainMenuItemsParams) => {
          const familyMenuItems: (MenuItemDef | string)[] = [
            {
              name: 'Añadir familia',
              action: () => {
                this.openAddFamilyModal();
              },
            },
            'separator',
            ...params.defaultItems.slice(0),
          ];
          return familyMenuItems;
        },
      },

      {
        field: 'idSubfamilia',
        headerName: 'Presentación',
        editable: true,
        width: 150,
        filter: true,
        cellEditor: 'agSelectCellEditor',
        mainMenuItems: (params: GetMainMenuItemsParams) => {
          const subFamilyMenuItems: (MenuItemDef | string)[] = [
            {
              name: 'Añadir subfamilia',
              action: () => {
                this.openAddSubFamilyModal();
              },
            },
            'separator',
            ...params.defaultItems.slice(0),
          ];
          return subFamilyMenuItems;
        },
        cellEditorParams: (params) => {
          // Obtener el idFamilia de la fila actual
          const idFamilia = params.data.idFamilia;

          // Filtrar subfamilias por parentId (idFamilia) usando subfamilias2
          const subfamiliasFiltradas = this.subfamilias2.filter(
            (item) => item.parentId === idFamilia
          );

          return {
            values: subfamiliasFiltradas.map((item) => item.id),
            valueFormatter: (id) => {
              const foundItem = subfamiliasFiltradas.find(
                (item) => item.id === id
              );
              return foundItem ? foundItem.description : id;
            },
          };
        },
        valueFormatter: (params) => {
          // Mostrar la descripción de la subfamilia usando subfamilias2
          const foundItem = this.subfamilias2
            ? this.subfamilias2.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
        valueGetter: (params) => {
          console.log(params)
          if (!params.data || !params.data.idSubfamilia) return '';
          const familias = this.subfamilias2?.find(b => b.id === params.data.idSubfamilia);
        
          return familias ? familias.description : '';
        },
      },*/
    ];
  }

  onMasterSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      // Crear una copia profunda del dato seleccionado
      this.masterSelectedRowData = { ...selectedNodes[0].data };
    } else {
      this.masterSelectedRowData = null;
    }
  }

  onMasterCellValueChanged(event: any) {
    const updatedData = { ...event.data };

    // Preservar el estado temporal y la selección
    if (this.newlyAddedMasterRows.includes(updatedData.id)) {
      updatedData.__isNew = true;
    }

    updatedData.__modified = true;
    this.masterNotSavedChanges = true;

    // Actualizar el array de datos
    this.masterRowData = this.masterRowData.map((row) =>
      row.id === updatedData.id ? updatedData : row
    );

    // Actualizar la fila en la cuadrícula
    const rowNode = this.masterGridApi.getRowNode(updatedData.id);
    if (rowNode) {
      rowNode.setData(updatedData);
      // Mantener la selección si es necesario
      if (
        this.masterSelectedRowData &&
        this.masterSelectedRowData.id === updatedData.id
      ) {
        rowNode.setSelected(true);
      }
    }
    if (event.colDef.field === 'idBranch') {
      const selectedBranch = event.newValue;
      const branchInfo = this.branchs?.find(
        (item) => item.name === selectedBranch
      );
        this.customerService
          .getCustomers(branchInfo.id, 'PROVIDERS')
          .subscribe({
            next: (data: any) => {
              this.proveedoresData = data;
            },
            error: (error) => {
              console.error('Error obteniendo datos:', error);
            }
          });
      /*if (bonusInfo) {
        event.data.quantity = parseFloat(bonusInfo.valueAddition);
      }*/
    }
    if (event.colDef.field === 'idProveedor') {
      const selectedProveedor = event.newValue;
      const proveedorInfo = this.proveedoresData?.find(
        (item) => item.nameContact === selectedProveedor
      );
        
      console.log(proveedorInfo.id)
      /*if (bonusInfo) {
        event.data.quantity = parseFloat(bonusInfo.valueAddition);
      }*/
    }
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.masterGridApi = params.api;
  }

  onMasterRowSelected(event: any) {
    this.id = event.data.id;
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
  addMasterRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      vigente: true,
      idBranch: this.branchs,
      idProveedor: this.proveedoresData,
      idMateriales: this.materialsData,
      idFamilia: this.familias,
      idSubfamilia: this.subfamilias2,
    };

    // Actualizar el estado
    this.masterRowData = [newItem, ...this.masterRowData];
    this.newlyAddedMasterRows.push(tempId);
    this.masterNotSavedChanges = true;

    // Forzar la actualización de la cuadrícula y seleccionar la nueva fila
    this.masterGridApi.setGridOption('rowData', this.masterRowData);
    setTimeout(() => {
      const firstRowIndex = 0;

      this.masterGridApi.ensureIndexVisible(firstRowIndex);

      this.masterGridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'idBranch'
      });
    }, 0);

    // Asegurarnos de que la fila nueva esté seleccionada
    requestAnimationFrame(() => {
      const rowNode = this.masterGridApi.getRowNode(tempId);
      if (rowNode) {
        rowNode.setSelected(true);
        this.masterSelectedRowData = newItem;
      }
    });

  }

  async saveMasterChanges() {
    const isValid = this.masterRowData.every(
      (item) => item.insumo && item.description
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.masterRowData.filter((row) => row.__isNew);
    const modifiedRows = this.masterRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.branchesService.addBranch(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.branchesService.updateBranch(row.id, cleanedData);
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
      this.masterNotSavedChanges = false;
      this.newlyAddedMasterRows = [];
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

  async deleteBranch() {
    const selectedNodes = this.masterGridApi.getSelectedNodes();
    const selectedData = selectedNodes[0].data;
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    alerts
      .confirmAlert(
        'Eliminar Sucursal',
        'Está seguro de que desea eliminar esta sucursal?',
        'warning',
        'Sí, Eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          selectedData.active = 0;
          this.branchesService
            .deleteBranch(selectedData.id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar sucursal',
                  error.error.message,
                  'error'
                );
                console.error('este es el error:', error.error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Eliminar sucursal',
                'La sucursal ha sido eliminada correctamente.',
                'success'
              );
              this.signalsService.triggerUpdateBranchList();
              this.obtenerDatos(); // Refrescar los datos después de eliminar
              this.masterNotSavedChanges = false;
              this.masterSelectedRowData = null;
            });
        }
      });
  }

  revertMasterData() {
    this.obtenerDatos();
    this.masterNotSavedChanges = false;
  }

  // ==================== UTILITY METHODS ====================

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.masterNotSavedChanges);
  }
}
