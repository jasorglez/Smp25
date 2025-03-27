import { Component, effect, HostListener, inject } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';

import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { CustomersPaymentsComponent } from './customers-payments.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { RadiusinfluenceComponent } from '../radiusinfluence/radiusinfluence.component';
import { CustomersService } from 'app/services/customers.service';

import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { InegiService } from 'app/services/inegi.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, MultiLineEditorComponent, 
    CustomersPaymentsComponent],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss']
})
export class CustomersComponent {
//  private administrationService = inject(AdministrationService);
private customerService    = inject(CustomersService);  
private modalServiceTable  = inject(ModalService);
private signalsService     = inject(SignalsService);
private modalService       = inject(NgbModal);
private route              = inject(ActivatedRoute);
private inegiService       = inject(InegiService);

  ngOnInit() {
    this.obtenerDatos();
    this.signalsService.deleteClientData();
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    
    this.route.data.subscribe(data => {
      this.type = data['type']; // 'CUSTOMERS' o 'PROVIDERS'

      this.obtenerDatos(); // Llamar a la función para cargar datos
    });
  }

  constructor() {

    effect(async () => {
      if (this.signalsService.getRefreshEmployees()() == true) {
        await this.obtenerDatos(); // Actualizar datos cuando se recibe señal
        this.signalsService.resetRefreshEmployees(); // Resetear la señal después de actualizar
      }
    });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerDatos();
      this.signalsService.deleteClientData();
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  type: string = ''; // Para almacenar el tipo (CUSTOMERS o PROVIDERS)
  gridHeight: string = '75vh';
  showCreditsTab: boolean = false;
  private gridApi: GridApi;
  notSavedChanges: boolean = false;
  selectedRowData: any = null;
  isOpen: boolean = false;

  
  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;
  
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  
  id: string;
  idRoot: number;
  private tempIdCounter: number = 0;
  selectedTab: string = 'customers-payments';
  idBranch: number = null;
  idEmployee: number;
  infoCp: any;


  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1,
  };

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
  };



  idClient = this.signalsService.getIdClient();
  nameClient = this.signalsService.getNameClient()();

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  
  
  get colMaster(): ColDef[] {
    return [
      { field: 'id', headerName: 'Id', editable: false, width: 53, hide : false,
        filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
              filterOptions: ['equals'], // Opciones de filtro
     },
    },
      {
        field: 'company', headerName: 'Compania', editable: false, 
        width: 250, 
        suppressMovable: true,
        filter: 'agTextColumnFilter',
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
      { field: 'nameContact', headerName: 'Nombre Contacto', editable: true, filter: true, width: 200 },
      { field: 'total', headerName: this.type === 'CUSTOMERS' ? 'Total Credito':'Cuentas X Pagar',
         editable: false, 
        filter:'agNumberColumnFilter', suppressMovable: true, 
        width: 160, 
        valueFormatter: (params) => {
          if (params.value) {
            return new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
            }).format(params.value);
          }
          return '$0.00';
        },
      },
      { field: 'cp', headerName: 'CP', editable: true, filter: true, width: 105 },
      {
        field: 'address', headerName: 'Direccion', editable: false, width: 250, filter: true,
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
        field: 'addressfiscal', headerName: 'Direccion Fiscal', editable: false, width: 250, filter: true, hide: true,
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
      { field: 'state', headerName: 'Estado', editable: true, filter: true, width: 160 },
      { field: 'city', headerName: 'Ciudad', editable: true, width: 120, filter: true },
      {
        field: 'neighborhood',
        headerName: 'Colonia',
        editable: true,
        filter: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          if (this.infoCp && this.infoCp.length > 0) {
            const asentamientos = this.infoCp[0].asentamientos;
            return {
              values: asentamientos,
            };
          }
          return { values: [] };
        },
        valueFormatter: (params) => {
          return params.value || 'Seleccionar asentamiento';
        },
      },
      {
        field: 'phone', headerName: 'Telefono', editable: true, width: 120, cellEditorParams: {
          maxLength: 15
        }
      },
      { field: 'rfc', headerName: 'RFC', editable: true, hide: true, width: 100 },
      { field: 'typeCustomer', headerName: this.type === 'CUSTOMERS' ? 'Tipo Cliente' : 'Tipo Proveedor',
        editable: true, width: 135 },
      { field: 'radio', headerName: 'Radio', editable: true, width: 90 }, 
      { field: 'latitud', headerName: 'Latitud', editable: true, width: 110, filter: true },
      { field: 'longitud', headerName: 'Longitud', editable: true, width: 120, filter: true },
      
      {
        field: 'email', headerName: 'Correo', width: 200, cellEditor: 'agTextCellEditor',
        editable: (params) => params.data.__isNew,
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
        }
      },
      { field: 'vigente', headerName: 'Vigente', editable: true, width: 100, filter: true },
    ];
  }

  obtenerDatos() {
    this.customerService.getCustomers(this.idBranch,this.type).subscribe((data: any) => {
      this.rowData = data;
    });
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.idClient = this.selectedRowData.id;
      console.log('ID del empleado seleccionado:', this.idClient);
      this.signalsService.setIdClient(this.selectedRowData.id);
      this.signalsService.setNameClient(this.selectedRowData.company);
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;

    if (event.colDef.field === 'cp') {
      event.data.neighborhood = '';

      this.getZipCodeData(event.newValue).then((data: any) => {
        if (data && data.length > 0) {
          const cpData = data[0];
          event.data.state = cpData.estado;
          event.data.city = cpData.ciudad || 'N/A';

          this.gridApi.applyTransaction({ update: [event.data] });
        }
      });
    }
  }

  async getZipCodeData(cp: string): Promise<any> {
    try {
      const data = await lastValueFrom(this.inegiService.getZipCodeData(cp));
      this.infoCp = data;
      console.log(this.infoCp);
      return data;
    } catch (error) {
      if (error.status === 404) {
        alerts.basicAlert(
          'Código Postal',
          'El código postal no existe o no se encontró información.',
          'error'
        );
      } else {
        console.error('Error fetching data:', error);
      }
      return null;
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBranch: this.idBranch,
      nameContact   : '',
      company       : '',
      phone         : '',
      rfc           : '',
      city          : '',
      mobile        : '',
      email         : '',
      address       : '',
      addressfiscal : '',
      state         : '',
      total         : 0,
      radio         : 0,
      vigente       : true,
      NumCliente    : 0,
      latitud       : '',
      longitud      : '',
      type          : this.type,
      active        : true,
      __isNew: true,
    };
    console.log('Nuevo registro:', newItem);
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.nameContact || item.company);
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
      return this.customerService.addCustomer(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('Actualizando cliente con los siguientes datos:', cleanedData);
      return this.customerService.updateCustomer(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

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
      await this.obtenerDatos();

       // Seleccionar la fila apropiada después de recargar
       if (this.lastEditedRowId) {
        if (this.lastEditedRowId === 'SELECT_MAX_ID') {
          // Encontrar el ID máximo en los datos actuales
          const maxId = Math.max(...this.rowData.map(row => Number(row.id)));
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

  private selectRowById(id: number | string) {
    // Dar tiempo al grid para que se actualice
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        // Convertir ambos IDs a número para la comparación
        const nodeId = typeof node.data.id === 'string' ? parseInt(node.data.id) : node.data.id;
        const searchId = typeof id === 'string' ? parseInt(id) : id;

        if (nodeId === searchId) {
          node.setSelected(true);
          this.gridApi.ensureNodeVisible(node, 'middle');
        }
      });
    }, 100);
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
    this.customerService.deleteCustomer(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Error al eliminar la entrada.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    ).subscribe(() => {
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


    openRadiusInfluenceModal(): void {
      const modalRef = this.modalService.open(RadiusinfluenceComponent, { size: 'lg' });
    }

    async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
      this.signalsService.setProviderOrCustomer(this.type);
      const colId = event.column.getColId();
      const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
      const selectedId = selectedRowData.id; // Obtener el ID del registro
    
      // Filtrar el grid para mostrar solo el registro con el ID seleccionado
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };
    
      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
    
      // Mostrar el componente <app-employeesxloans>
      if(colId === 'total') {
        this.activateCreditsTab();
      }
     
      console.log('Datos ShowCredits:', this.showCreditsTab);
      this.selectedRowData = selectedRowData; // Guardar los datos seleccionados
    }
  

    async activateCreditsTab() {
      if(!this.isOpen) {
        setTimeout(async () => await this.adjustGridSize(), 0);
        this.showCreditsTab = true;
        this.isOpen = true;
      }
      else {
        this.resetGridSize();
        this.isOpen = false;
      }
    }

    resetGridSize() {
      this.gridHeight = '80vh'; // Reset to default height
      this.showCreditsTab = false;
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }

    adjustGridSize() {
      this.gridHeight = '20vh'; // Adjust as needed
    }
}


