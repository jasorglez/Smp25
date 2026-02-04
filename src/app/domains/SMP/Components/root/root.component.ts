import { Component, HostListener, effect, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { ContractsService } from 'app/services/contracts.service';
import { concat, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { BranchsService } from 'app/services/branchs.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { WarehousesService } from 'app/services/warehouses.service';
import { CustomersService } from 'app/services/customers.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { AdministrationService } from 'app/services/administration.service';
import { InegiService } from 'app/services/inegi.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './root.component.html'
})
export class RootComponent {

  
  private rootService = inject(RootService);
  private imageHandlerService = inject(ImageHandlerService);
  private branchesService = inject(BranchsService);
  private warehousesService = inject(WarehousesService);
  private customersService = inject(CustomersService);
  private catalogsService = inject(CatalogsService);
  private administrationService = inject(AdministrationService);
  private inegiService = inject(InegiService);
  private signalsService = inject(SignalsService);

  notSavedChanges: boolean = false;
  rowData: any[] = [];
  contracts: { [key: string]: string } = {};
  estados: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  idUser: number = null;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  ngOnInit() {
    this.idUser = this.signalsService.getIdUSer()();
    this.obtenerDatos();
    this.obtenerEstados();
  }

  obtenerEstados() {
    this.inegiService.getEstados().subscribe({
      next: (response: any) => {
        if (response?.datos) {
          this.estados = response.datos.reduce((acc: any, estado: any) => {
            acc[estado.nom_agee] = estado.nom_agee;
            return acc;
          }, {});
        }
        this.refreshColumnDefs();
      },
      error: (error) => {
        console.error('Error obteniendo estados:', error);
        // Estados de México por defecto si falla el API
        //los Estados de México por defecto si falla el API
        this.estados = {
          'Aguascalientes': 'Aguascalientes',
          'Baja California': 'Baja California',
          'Baja California Sur': 'Baja California Sur',
          'Campeche': 'Campeche',
          'Chiapas': 'Chiapas',
          'Chihuahua': 'Chihuahua',
          'Ciudad de México': 'Ciudad de México',
          'Coahuila': 'Coahuila',
          'Colima': 'Colima',
          'Durango': 'Durango',
          'Estado de México': 'Estado de México',
          'Guanajuato': 'Guanajuato',
          'Guerrero': 'Guerrero',
          'Hidalgo': 'Hidalgo',
          'Jalisco': 'Jalisco',
          'Michoacán': 'Michoacán',
          'Morelos': 'Morelos',
          'Nayarit': 'Nayarit',
          'Nuevo León': 'Nuevo León',
          'Oaxaca': 'Oaxaca',
          'Puebla': 'Puebla',
          'Querétaro': 'Querétaro',
          'Quintana Roo': 'Quintana Roo',
          'San Luis Potosí': 'San Luis Potosí',
          'Sinaloa': 'Sinaloa',
          'Sonora': 'Sonora',
          'Tabasco': 'Tabasco',
          'Tamaulipas': 'Tamaulipas',
          'Tlaxcala': 'Tlaxcala',
          'Veracruz': 'Veracruz',
          'Yucatán': 'Yucatán',
          'Zacatecas': 'Zacatecas'
        };
        this.refreshColumnDefs();
      }
    });
  }

  refreshColumnDefs() {
    this._columnDefs = [];
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.columnDefs);
    }
  }
  constructor() {
      effect(() => {
        this.idUser = this.signalsService.getIdUSer()();
        this.obtenerDatos();
      });
    }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }



  obtenerDatos() {
    this.rootService
      .getRoot()
      .subscribe((data: any) => {
        this.rowData = data;
     //   console.log(data)
      });
  }

  components = {
    autocompleteEditor: AutocompleteEditorComponent
  }

  public defaultColDef : ColDef = {
    sortable           : true,
    resizable          : true,
    flex               : 1
  };

  // Orden de columnas editables para navegación con Enter
  private editableColumnOrder = [
    'orden', 'name', 'nameSmall', 'rfc', 'personType', 'email', 'phone',
    'address', 'city', 'state', 'cp', 'country', 'web', 'formatRep', 'advanced'
  ];

// Column Definitions: Defines the columns to be displayed.
public gridOptions: any = {
  headerHeight: 30,
  rowHeight: 60,
  stopEditingWhenCellsLoseFocus: true,
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
  }
};

  // Mover a la siguiente celda editable con Enter
  onCellEditingStopped(event: any) {
    if (event.valueChanged || event.oldValue === event.newValue) {
      const currentColId = event.column.getColId();
      const currentIndex = this.editableColumnOrder.indexOf(currentColId);

      if (currentIndex !== -1 && currentIndex < this.editableColumnOrder.length - 1) {
        const nextColId = this.editableColumnOrder[currentIndex + 1];
        setTimeout(() => {
          this.gridApi.startEditingCell({
            rowIndex: event.rowIndex,
            colKey: nextColId
          });
        }, 50);
      }
    }
  }

  private _columnDefs: ColDef[] = [];

  get columnDefs(): ColDef[] {
    if (this._columnDefs.length > 0) {
      return this._columnDefs;
    }

    this._columnDefs = [
      {
        headerName: '#',
        valueGetter: (params) => {
          if (params.node && params.node.rowIndex !== null) {
            return params.node.rowIndex + 1;
          }
          return '';
        },
        editable: false,
        width: 50,
        maxWidth: 50,
        pinned: 'left',
        cellStyle: {
          fontWeight: 'bold',
          textAlign: 'center',
          backgroundColor: '#f8f9fa'
        }
      },
      {
        field: 'orden',
        headerName: 'Orden',
        editable: true,
        minWidth: 70,
        width: 80,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 0,
          precision: 0
        },
        valueParser: (params) => Number(params.newValue),
        cellStyle: { textAlign: 'center' }
      },
      {
        field: 'name',
        headerName: 'Nombre',
        editable: true,
        minWidth: 180,
        width: 200,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData.map(e => e.name),
          filterKey: 'name',
          placeholder: 'Nombre...',
          minLength: 1
        },
        valueSetter: (params) => {
          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.name === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Código duplicado',
              'Ya existe una empresa con ese nombre.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        }
      },
      {
        field: 'nameSmall',
        headerName: 'Corto',
        editable: true,
        minWidth: 90,
        width: 110,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData.map(e => e.nameSmall),
          filterKey: 'nameSmall',
          placeholder: 'Nombre...',
          minLength: 1
        },
        valueSetter: (params) => {
          if (params.newValue.length > 10) {
            alerts.basicAlert(
              'Error de validación',
              'El nombre corto no puede tener más de 10 caracteres.',
              'error'
            );
            return false;
          }

          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.nameSmall === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Código duplicado',
              'Ya existe una empresa con ese nombre',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        }
      },
      {
        field: 'rfc',
        headerName: 'RFC',
        editable: true,
        minWidth: 120,
        width: 130
      },
      {
        field: 'personType',
        headerName: 'Tipo',
        editable: true,
        minWidth: 80,
        width: 90,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['MORAL', 'FISICA']
        }
      },
      {
        field: 'email',
        headerName: 'Email',
        cellEditor: 'agTextCellEditor',
        editable: (params) => params.data.__isNew,
        minWidth: 150,
        width: 180,
        cellEditorParams: {
          useFormatter: true,
        },
        valueFormatter: (params) => params.value,
        valueSetter: (params) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(params.newValue)) {
            const duplicateExists = this.rowData.some((row, index) =>
              index !== params.node.rowIndex && row.email === params.newValue
            );

            if (duplicateExists) {
              alerts.basicAlert(
                'Añadir usuario',
                'Ya existe un usuario con ese correo electrónico.',
                'error'
              );
              return false;
            }

            params.data[params.colDef.field] = params.newValue;
            return true;
          } else {
            alerts.basicAlert(
              'Editar usuario',
              'Correo electrónico no válido.',
              'error'
            );
            return false;
          }
        },
        filter: true
      },
      {
        field: 'phone',
        headerName: 'Teléfono',
        editable: true,
        minWidth: 100,
        width: 110
      },
      {
        field: 'address',
        headerName: 'Dirección',
        editable: true,
        minWidth: 150,
        width: 180
      },
      {
        field: 'city',
        headerName: 'Ciudad',
        editable: true,
        minWidth: 100,
        width: 110
      },
      {
        field: 'state',
        headerName: 'Estado',
        editable: true,
        minWidth: 140,
        width: 160,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: Object.keys(this.estados).sort(),
          searchDebounceDelay: 500,
          allowTyping: true,
          filterList: true,
          highlightMatch: true
        },
        valueFormatter: (params) => this.estados[params.value] || params.value || ''
      },
      {
        field: 'cp',
        headerName: 'CP',
        editable: true,
        minWidth: 60,
        width: 70
      },
      {
        field: 'country',
        headerName: 'País',
        editable: true,
        minWidth: 80,
        width: 90
      },
      {
        field: 'web',
        headerName: 'Web',
        editable: true,
        minWidth: 120,
        width: 140
      },
      {
        field: 'formatRep',
        headerName: 'Formato Rep.',
        editable: true,
        minWidth: 100,
        width: 110
      },
      {
        field: 'advanced',
        headerName: 'Avanzado',
        editable: true,
        cellEditor: 'agSelectCellEditor',
        minWidth: 80,
        width: 90
      },
      {
        field: 'picture',
        headerName: 'Logo',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture'
        },
        editable: false,
        minWidth: 100,
        width: 100
      },
      {
        field: 'picture2',
        headerName: 'Header',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture2'
        },
        editable: false,
        minWidth: 100,
        width: 100
      },
      {
        field: 'picture3',
        headerName: 'Footer',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture3'
        },
        editable: false,
        minWidth: 100,
        width: 100
      },
    ];

    return this._columnDefs;
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      orden: 0,
      name: '',
      web : '',
      email: 'info@x.com',
      nameSmall: '',
      picture: '',
      picture2: '',
      picture3: '',
      phone: 'sintel',
      address: 'sin direccion',
      consortium: 'NO',
      formatRep: '',
      city: '',
      advanced: false,
      state: '',
      country: '',
      rfc: '',
      cp: '',
      active: 1,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Auto-focus en la primera columna editable
    setTimeout(() => {
      const firstRowIndex = 0;
      this.gridApi.ensureIndexVisible(firstRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'name'
      });
    }, 50);
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.name && item.nameSmall);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar los campos Nombre y Nombre Corto antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    try {
      // Procesar nuevas empresas
      for (const row of newRows) {
        const cleanedData = this.cleanDataForServer(row);
        console.log('Creando empresa:', cleanedData);

        // 1. Crear Root (Empresa)
        const rootResponse: any = await lastValueFrom(this.rootService.addRoot(cleanedData));
        const rootId = rootResponse?.id || rootResponse?.data?.id;

        if (!rootId) {
          console.error('No se pudo obtener el ID de la empresa:', rootResponse);
          alerts.basicAlert('Error', 'No se pudo crear la empresa', 'error');
          continue;
        }
        alerts.toastAlert('Empresa creada correctamente', 'success');

        // Asignar permiso de root al usuario
        try {
          await lastValueFrom(
            this.branchesService.assignPermissionAfterCreation(this.idUser, rootId, 'root')
          );
          console.log('Permiso root asignado');
        } catch (permError) {
          console.error('Error asignando permiso root:', permError);
        }

        // 2. Crear Branch (Sucursal Principal)
        let branchId = null;
        try {
          const branchData = {
            idCompany: rootId,
            idEstado: 0,
            name: 'SUCURSAL PRINCIPAL',
            description: 'Sucursal principal creada automáticamente',
            address: row.address || '',
            orden: 1,
            vigente: true,
            active: true
          };
          const branchResponse: any = await lastValueFrom(this.branchesService.addBranch(branchData));
          branchId = branchResponse?.id || branchResponse?.data?.id;

          if (branchId) {
            alerts.toastAlert('Sucursal creada correctamente', 'success');
            // Asignar permiso de branch al usuario
            await lastValueFrom(
              this.branchesService.assignPermissionAfterCreation(this.idUser, branchId, 'branch')
            );
          }
        } catch (branchError) {
          console.error('Error creando sucursal:', branchError);
          alerts.toastAlert('Error al crear sucursal', 'error');
        }

        // 3. Crear AccountBanks (Cuenta Bancaria)
        try {
          const accountBankData = {
            idBussines: rootId,
            numberAccount: '',
            nameAccount: 'CUENTA PRINCIPAL',
            signAccount: '',
            interbancaria: '',
            folioCheque: '',
            folioSinCheque: '',
            idBanco: 0,
            maskin: '',
            consecin: 0,
            maskex: '',
            consecex: 0,
            eAplicaFiscal: 'NO',
            active: true
          };
          await lastValueFrom(this.administrationService.addAccountBanks(accountBankData));
          alerts.toastAlert('Cuenta bancaria creada correctamente', 'success');
        } catch (bankError) {
          console.error('Error creando cuenta bancaria:', bankError);
          alerts.toastAlert('Error al crear cuenta bancaria', 'error');
        }

        // 4. Crear Warehouse (Almacén) - Solo si tenemos branchId
        if (branchId) {
          try {
            const warehouseData = {
              idBranch: branchId,
              place: '',
              name: 'ALMACEN PRINCIPAL',
              address: row.address || '',
              state: row.state || '',
              city: row.city || '',
              codePostal: row.cp || '',
              phone: row.phone || '',
              leader: '',
              principal: true,
              active: true
            };
            await lastValueFrom(this.warehousesService.addWarehouse(warehouseData));
            alerts.toastAlert('Almacén creado correctamente', 'success');
          } catch (warehouseError) {
            console.error('Error creando almacén:', warehouseError);
            alerts.toastAlert('Error al crear almacén', 'error');
          }

          // 5. Crear Customer (Cliente por defecto)
          try {
            const customerData = {
              idRoot: rootId,
              idBranch: branchId,
              idTypecop: 0,
              nameContact: '',
              company: 'CLIENTE MOSTRADOR',
              rfc: 'XAXX010101000',
              city: row.city || '',
              position: '',
              address: '',
              addressFiscal: '',
              cp: '',
              state: row.state || '',
              neighborhood: '',
              total: 0,
              radio: 0,
              phone: '',
              mobile: '',
              email: '',
              vigente: true,
              numCliente: 1,
              latitud: '',
              longitud: '',
              typeCustomer: 'CLIENTE',
              typework: '',
              typeIntOrExt: '',
              type: 'CUSTOMER',
              fieldContact: 0,
              fieldBank: 0,
              fieldCuenta: 0,
              active: true
            };
            await lastValueFrom(this.customersService.addCustomer(customerData));
            alerts.toastAlert('Cliente mostrador creado correctamente', 'success');
          } catch (customerError) {
            console.error('Error creando cliente:', customerError);
            alerts.toastAlert('Error al crear cliente', 'error');
          }
        }

        // 6. Crear Catalog (Unidad de medida - PIEZA)
        try {
          const catalogData = {
            idCompany: rootId,
            description: 'PIEZA',
            valueAddition: 'PZA',
            valueAddition2: '',
            valueAdditionBit: true,
            valueAdditionBit2: false,
            valueAdditionBit3: false,
            parentId: 0,
            subParentId: 0,
            price: 0,
            type: 'MEASURE',
            vigente: true,
            active: 1
          };
          await lastValueFrom(this.catalogsService.addCatalog(catalogData));
          alerts.toastAlert('Unidad de medida creada correctamente', 'success');
        } catch (catalogError) {
          console.error('Error creando catálogo:', catalogError);
          alerts.toastAlert('Error al crear unidad de medida', 'error');
        }

        // 7. Crear Setup (Configuración Fiscal/Billing Management)
        try {
          const setupData = {
            idRoot: rootId,
            emisorRfc: row.rfc || '',
            emisorNombre: row.name || '',
            emisorCp: row.cp || '',
            fiscalYear: new Date().getFullYear(),
            fiscalRegime: 0,
            prefix: '',
            consecutive: 1,
            prefixexp: '',
            consecutivexp: 1,
            iIva: 16,
            iIeps: 0,
            iI3: 0,
            rIva: 0,
            rIeps: 0,
            efirmaPass: '',
            dateStart: new Date().toISOString(),
            dateEnd: new Date().toISOString(),
            cerFileContent: '',
            keyFileContent: '',
            active: true
          };
          await lastValueFrom(this.administrationService.addBillingManagementInfo(setupData));
          alerts.toastAlert('Configuración fiscal creada correctamente', 'success');
        } catch (setupError) {
          console.error('Error creando configuración fiscal:', setupError);
          alerts.toastAlert('Error al crear configuración fiscal', 'error');
        }
      }

      // Procesar empresas modificadas
      for (const row of modifiedRows) {
        const cleanedData = this.cleanDataForServer(row);
        await lastValueFrom(this.rootService.updateRoot(row.id, cleanedData));
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );

      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error('Error al guardar:', error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
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

}
