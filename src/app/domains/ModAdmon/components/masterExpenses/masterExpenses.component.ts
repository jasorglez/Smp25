import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
} from '@angular/core';
import { IncomesAndExpensesService } from 'app/services/incomes-and-expenses.service';
import { SignalsService } from 'app/services/signals.service';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray, tap } from 'rxjs';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import {
  CellDoubleClickedEvent,
  IFilterComp,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { InegiService } from 'app/services/inegi.service';
import { States } from 'app/interface/states';
import { BranchsService } from 'app/services/branchs.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { RootService } from 'app/services/root.service';
import { number } from 'echarts';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-master-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './masterExpenses.component.html',
})
export class MasterExpensesComponent {
  private trackingService = inject(TrackingService);
  store: any[] = [];
  idcompany: number = null;
  rowData: any[] = [];
  masterSelectedRowData: any = null;
  newlyAddedMasterRows: string[] = [];
  gridHeight: string = '85vh';
  id: number = null;
  branchs: any[] = [];
  idBranch: number;
  expenses : any[] = [];
  company: any[] = [];
  idUser: number = null;
  notSavedChanges: boolean = false;
  showLoansTab: boolean = false;
  selectedRowData: any = null;
  showSavingsTab: boolean = false;
  authorizedPass: boolean = false;
  private lastEditedRowId: number | string | null = null;
  newlyAddedRows: string[] = [];

  companySelect: number;
  branchSelect: number;

  private cataalogAdmonService = inject(CatalogadmonService);
  private estados: string[] = [];
  private inegiService = inject(InegiService);
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private signalsService = inject(SignalsService);
  private incomesAndExpensesService = inject(IncomesAndExpensesService);
  private branchesService = inject(BranchsService);
  private rootService = inject(RootService);
  private isOpen: boolean = false;

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
  };

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1,
  };
  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  constructor() {
    effect(() => {
      this.idUser = this.signalsService.getIdUSer()();
      this.idcompany = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      
      this.obtenerDatos();
      this.getBills();
      this.getCompanys();
    });
  }
  obtenerBranchs() {
    this.branchesService.getBrancheswoa(this.companySelect).subscribe(
      (data: any) => {
        this.branchs = data;
        console.log('Branchs', this.branchs);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  obtenerDatos() {
    this.incomesAndExpensesService.getIncomesAll().subscribe({
      next: (data: any) => {
        this.rowData = data;
        console.log(this.rowData);
        this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Gastos', 'Menu Administracion Gastos',  this.trackingService.getEmail());
      },
      error: (error) => {
        if (error.status === 404) this.store = [];
        console.error('Error fetching data:', error);
      },
    });
  }

  getBills() {
    this.cataalogAdmonService.getCatalogs(this.branchSelect, 'BILL').subscribe(
      (data: any) => {
        this.expenses = data;
        console.log(this.expenses)
      },
      error => {
        console.error(error);
      }
    )
  }
  getCompanys() {
    this.rootService.getRoot().subscribe(
      (data: any) => {
        this.company = data;
        console.log(this.company)
      },
      error => {
        console.error(error);
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

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    groupDefaultExpanded: -1, // -1 significa expandir todos los niveles
    //suppressDragLeaveHidesColumns: true,
    //suppressMakeColumnVisibleAfterUnGroup: true,
    rowBuffer: 20,
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
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
  };
  onMasterSelectionChanged(event: any) {}

  onMasterCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
    if (event.colDef.field === 'name') {
      const companyName = event.newValue;
      
      const companyId = this.getCompanyIdByName(companyName);
      console.log('Sucursal seleccionada:', companyName, 'ID:', companyId);
      // Si necesitas guardar el ID también en el row:
      this.companySelect = companyId;
      this.obtenerBranchs();
      //event.data.idBranch = companyId;
    }
    if (event.colDef.field === 'namebranch') {
      const branchName = event.newValue;
      
      const branchId = this.getBranchIdByName(branchName);
      console.log('Sucursal seleccionada:', branchName, 'ID:', branchId);
      this.branchSelect = branchId;
      this.getBills();
      // Si necesitas guardar el ID también en el row:
      //event.data.idBranch = branchId;
    } 
    if (event.colDef.field === 'numberdocument') {
      const branchName = event.newValue;
      
      const branchId = this.getBranchIdByName(branchName);
      console.log('Sucursal seleccionada:', branchName, 'ID:', branchId);
      //alert(branchId);
      // Si necesitas guardar el ID también en el row:
      event.data.idBranch = branchId;
    }
  }

  getBranchIdByName(name: string): number | undefined {
    const match = this.branchs.find(branch => branch.name === name);
    return match?.id;
  }
  getCompanyIdByName(name: string): number | undefined {
    const match = this.company.find(company => company.name === name);
    return match?.id;
  }
  

  onMasterGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onMasterRowSelected(event: any) {
    this.id = event.data.id;
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    this.notSavedChanges = true;
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

  private formatDate(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    return [
      date.getDate().toString().padStart(2, '0'),
      (date.getMonth() + 1).toString().padStart(2, '0'),
      date.getFullYear()
    ].join('-');
  }

  get colMaster(): ColDef[] {
    return [
      {
        field: 'name',
        headerName: 'Empresa',
        editable: true,
        //showRowGroup: true,
        width: 100,
        hide: this.idUser != 42,
        rowGroup: this.idUser == 42,
        rowGroupIndex: 1,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.company
            ? this.company.map((item) => item.name)
            : [],
        },
        valueFormatter: (params) => {
          return params.value || '';
        },
      },
      {
        field: 'namebranch',
        headerName: 'Sucursal',
        editable: true,
        //showRowGroup: true,
        width: 100,
        hide: this.idUser != 42,
        rowGroup: this.idUser == 42,
        rowGroupIndex: 2,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.branchs
            ? this.branchs.map((item) => item.name)
            : [],
        },
        valueFormatter: (params) => {
          return params.value || '';
        },
      },
      {
        field: 'numberdocument',
        headerName: 'Documento',
        editable: true,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData?.map((e) => e.numberdocument?.toUpperCase()) || [],
          filterKey: 'numberdocument',
          placeholder: 'Buscar código...',
          minLength: 1,
        },
        //showRowGroup: true,
        width: 100,
        hide: this.idUser != 42,
        rowGroup: this.idUser == 42,
        rowGroupIndex: 3,
      },
      {
        field: 'description',
        headerName: 'Descripcion',
        editable: true,
        width: 100,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData?.map((e) => e.description?.toUpperCase()) || [],
          filterKey: 'description',
          placeholder: 'Buscar código...',
          minLength: 1,
        },
      },
      /*{
        field: 'description',
        headerName: 'Descripcion',
        editable: true,
        width: 100,
      },*/
      {
        field: 'dateexpend',
        headerName: 'Fecha',
        editable: true,
        width: 100,
        cellDataType: 'date',
        valueFormatter: (params) => this.formatDate(params.value)
      },
      {
        field: 'typeexpense',
        headerName: 'Tipo de gasto',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.expenses
            ? this.expenses.map((item) => item.description)
            : [],
        },
        valueFormatter: (params) => {
          return params.value || '';
        },
        
      },      
      {
        field: 'quantity',
        headerName: 'Cantidad',
        editable: true,
        width: 100,
      },
      {
        field: 'id_customer',
        headerName: 'Id',
        editable: true,
        width: 100,
      },
      {
        field: 'description',
        headerName: 'Concepto',
        editable: true,
        width: 100,
      },
      {
        field: 'price',
        headerName: 'Precio',
        editable: true,
        width: 100,
      },
      {
        field: 'totalDetalle',
        headerName: 'subtotal',
        editable: false,
        width: 100,
      },
    ];
  }
  detailCellRendererParams: any = {
    detailGridOptions: {
      columnDefs: [
        { field: "callId" },
        { field: "direction" },
        { field: "number", minWidth: 150 },
        { field: "duration", valueFormatter: "x.toLocaleString() + 's'" },
        { field: "switchCode", minWidth: 150 },
      ],
      defaultColDef: {
        flex: 1,
      },
    },
    getDetailRowData: function (params) {
      params.successCallback(params.data.callRecords);
    },
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
    const newItem1 = {
      //id: tempId,
      name: '',
      namebranch: '',
      numberdocument: '',
      dateexpend: new Date().toISOString(),
      typeexpense: '',
      quantity: null,
      id_customer: null,
      description: '',
      price: null,
      totalDetalle: null,
      active: true,
      __isNew: true,
    };
    const newItem2 = {
      //id: tempId,
      name: '',
      namebranch: '',
      numberdocument: '',
      typeexpense: '',
      quantity: null,
      id_customer: null,
      description: '',
      price: null,
      totalDetalle: null,
      active: true,
      __isNew: true,
    };

    //this.rowData.push(newItem);
    this.rowData = [newItem1, newItem2,...this.rowData];
    this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Gastos', 'Menu Administracion Gastos',  this.trackingService.getEmail());
  }


  async saveMasterChanges() {
    /*const isValid = this.rowData.every(
      (item) => item.namebranch && item.dateexpendty && item.dateexpend
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
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Gastos', 'Menu Administracion Gastos',  this.trackingService.getEmail());
      return lastValueFrom(this.incomesAndExpensesService.addIncomesAndExpenses(cleanedData));
    });

    const updateObservables: Promise<any>[] = modifiedRows.map((row) => {      
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Gastos', 'Menu Administracion Gastos',  this.trackingService.getEmail());
      return lastValueFrom(this.incomesAndExpensesService.updateIncomesAndExpenses(row.id, cleanedData));
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

        if (response.id && correspondingNewRow) {
          //console.log(response)

          try {
            await lastValueFrom(
              this.branchesService.assignPermissionAfterCreation(
                this.idUser, //id user
                response.id,
                'store'
              )
            );
          } catch (permError) {
            console.error('Error asignando permiso:', permError);
            // Opcional: Mostrar alerta pero no interrumpir el flujo principal
            alerts.basicAlert(
              'Advertencia',
              'Se creó la sucursal pero hubo un problema asignando los permisos.',
              'warning'
            );
          }
        }
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
    if (selectedData.loan && selectedData.loan !== 0) {
      alerts.basicAlert(
        'Error al eliminar',
        'No se puede eliminar el empleado mientras tenga préstamos activos',
        'error'
      );
      return;
    }

    const id = selectedData.id;
    selectedData.active = 0;
    alerts
      .confirmAlert(
        'Eliminar Tienda',
        '¿Está seguro que desea eliminar esta tienda?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.incomesAndExpensesService
            .deleteConceptFromIncomesAndExpenses(id)
            .pipe(
              catchError((error) => {
                alerts.basicAlert(
                  'Eliminar tienda',
                  'Error al eliminar la tienda.',
                  'error'
                );
                console.error(error);
                return EMPTY;
              })
            )
            .subscribe(() => {
              alerts.basicAlert(
                'Tienda eliminada',
                'La tienda se eliminó correctamente',
                'success'
              );
              this.obtenerDatos();
              this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Gastos', 'Menu Administracion Gastos',  this.trackingService.getEmail());
              this.notSavedChanges = false;
              this.selectedRowData = null;
            });
        }
      });
  }

  revertMasterData() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(),'Revertir Registro en Gastos', 'Menu Administracion Gastos',  this.trackingService.getEmail());
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

  // ==================== GUARD ALERT UNSAVED CHANGES ====================

  async canDeactivate(): Promise<boolean> {
    return confirmExitIfUnsaved(this.notSavedChanges);
  }
}
