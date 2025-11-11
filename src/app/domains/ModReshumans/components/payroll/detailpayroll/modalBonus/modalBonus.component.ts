import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { AdministrationService } from 'app/services/administration.service';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray, tap } from 'rxjs';
import {
  CellDoubleClickedEvent,
  IFilterComp,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CatalogsService } from 'app/services/catalogs.service';
import { EmployeesService } from 'app/services/employees.service'; 
import { AuthService } from 'app/services/auth.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';

@Component({
  selector: 'app-modal-bonus',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  templateUrl: './modalBonus.component.html',
})
export class ModalBonusComponent { 

  components = {
      autocompleteEditor: AutocompleteEditorComponent,
    };

  private signalsService = inject(SignalsService);
  private administrationService = inject(AdministrationService);
  private employeeService = inject(EmployeesService);
  private catalogsService = inject(CatalogsService);
  private lastEditedRowId: number | string | null = null;
  authService = inject(AuthService);

  idEmpleado: number = 0;
  idBranch: number = 0;
  idEmpresa: number = 0;
  incidentDate: string = '';
  gridApi!: GridApi;
  fechaInicio:string = '';
  fechaFin:string = '';
  id: number = 0;
  notSavedChanges: boolean = false;
  rowData: any[] = [];
  bonusCatalogos: any[] = [];
  bonusCatalogosVigentes: any[] = [];
  infoEmpelado: any = {};
  cleanedListData: any[] = [];
  newlyAddedRows: string[] = [];

  constructor() {
    effect(async () => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idEmpresa = this.signalsService.getRootSelectedBySidebar()();
      this.fechaInicio = this.signalsService.getFechaNomina().fechaInicio.split('T')[0];
      this.fechaFin = this.signalsService.getFechaNomina().fechaFin.split('T')[0];
      this.idEmpleado = this.signalsService.getIdEmployee()();
      await this.obtenerEmpleado();
      await this.obtenerBonos(); // ✅ espera que termine antes de continuar
      this.obtenerDatosCatalogos();
      this.obtenerDatosCatalogosVigente();
      if(this.authService.getCrudPermission('hr', 'payroll','','','', 'create')){
        this.addMasterRow(); // ✅ ahora sí, ya hay datos en rowData
      }
    });
  }


  obtenerBonos(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    this.administrationService
      .getEmployeesBonus(this.fechaInicio, this.fechaFin, this.idBranch)
      .subscribe({
        next: (data: any[]) => {
          const filtrado = data.filter(b => b.idEmployee === this.idEmpleado);
          this.rowData = filtrado;
          resolve(filtrado);
        },
        error: (error) => {
          console.error('Error fetching data:', error);
          reject(error);
        }
      });
  });
}
obtenerEmpleado(): Promise<any> {
  return new Promise((resolve, reject) => {
    this.employeeService.getEmployeeById(this.idEmpleado).subscribe({
      next: (data) => {
        this.infoEmpelado = data;

        resolve(data);
      },
      error: (error) => {
        console.error('Error fetching empleado:', error);
        reject(error);
      }
    });
  });
}



  obtenerDatosCatalogos() {
    //console.log("------- empresa para obtener catalogos: ", this.idEmpresa);
    this.catalogsService.getCatalogs(this.idEmpresa, 'BONUS').subscribe(
      (data) => {
        this.bonusCatalogos = data;
        console.log("------ Catalogo", data);
      },
      (error) => console.error('Error fetching measures:', error)
    );
  }
  obtenerDatosCatalogosVigente() {
    //console.log("------- empresa para obtener catalogos: ", this.idEmpresa);
    this.catalogsService.getCatalogsVigente(this.idEmpresa, 'BONUS').subscribe(
      (data) => {
        this.bonusCatalogosVigentes = data;
        console.log("------ Catalogo", data);
      },
      (error) => console.error('Error fetching measures:', error)
    );
  }
   get colMaster(): ColDef[] {
      return [
        {
        field: 'incidenceDate',
        headerName: 'Fecha',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('hr', 'payroll','','','', 'update');
        },
        headerClass: 'required-header',
        cellStyle: (params) => this.validateRequiredField(params.value),
        width: 200,
        flex: 1,
        cellEditor: 'agDateCellEditor',
        cellRenderer: 'agDateCellRenderer',
        cellEditorParams: {
          min: this.fechaInicio,
          max: this.fechaFin,
        },

        valueGetter: (params) =>
          params.data.incidenceDate
            ? new Date(params.data.incidenceDate)
            : null,

        valueFormatter: (params) => {
          if (params.value) {
            const date = new Date(params.value);
            this.incidentDate = `${('0' + date.getDate()).slice(-2)}-${(
              '0' +
              (date.getMonth() + 1)
            ).slice(-2)}-${date.getFullYear()}`;
            return this.incidentDate;
          }
          return '';
        },
      },
      {
        field: 'idBonus',
        headerName: 'Concepto',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('hr', 'payroll','','','', 'update');
        },
        filter: true,
        width: 150,
        filterParams: {
          // can be 'windows' or 'mac'
          defaultToNothingSelected: true,
          //excelMode: 'mac',
        },

        headerClass: 'required-header',
        flex: 1,
        cellEditor: 'agSelectCellEditor',
        cellStyle: (params) =>
          params.value == 'N/A' ? { backgroundColor: '#FFD6E7' } : null,

        cellEditorParams: {
          //values: this.bonusCatalogos ? this.bonusCatalogos.map((item) => item.description) : [],
          values: this.bonusCatalogosVigentes ? this.bonusCatalogosVigentes.map((item) => item.id) : [],

        },

        valueFormatter: (params) => {
          const foundItem = this.bonusCatalogos ? this.bonusCatalogos.find(item => item.id === params.value) : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
        valueGetter: (params) => {
          if (!params.data || !params.data.idBonus) return '';
          const catalog = this.bonusCatalogos?.find(b => b.id === params.data.idBonus);
          return catalog ? catalog.description : '';
        },
        valueParser: (params) => {
          const foundItem = this.bonusCatalogos ? this.bonusCatalogos.find(item => item.description === params.newValue) : null;
          return foundItem ? foundItem.id : params.newValue;
        },

      },
      {
        field: 'idBonus',
        headerName: 'Monto',
        editable: false,
        filter: false,
        flex: 1,
        /*  valueGetter: (params) => {
        const foundItem = this.bonusCatalogos ? this.bonusCatalogos.find(item => item.description === params.data.bonus) : null;
        return foundItem ? foundItem.valueAddition : '';
      } */
        valueFormatter: (params) => {
          const foundItem = this.bonusCatalogos?.find((item) => item.id === params.value);
          //console.log(foundItem)
          const value = foundItem ? foundItem.valueAddition : params.value;
          //console.log(value)
          return value
            ? `$${Number(value).toLocaleString('es-MX', {
                minimumFractionDigits: 2,
              })}`
            : '';
        },
      },
      ]
   }

  addMasterRow() {
     const newItem = {
      active: true,
      idBranch: this.infoEmpelado[0].idBranch,
      idEmployee: this.infoEmpelado[0].id,
      employeeName: this.infoEmpelado[0].name,
      incidenceDate: this.signalsService.getFechaNomina().fechaFin ? this.signalsService.getFechaNomina().fechaFin : '',
      fromPayroll: true,
      bonus: '',
      quantity: '',
      valid: true,
      vigente: false,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;
    setTimeout(() => {
      const firstRowIndex = 0;

      this.gridApi.ensureIndexVisible(firstRowIndex);

      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'idBonus'
      });
    }, 200);
  }
  async saveMasterChanges() {
    this.signalsService.triggerRefreshNomina();
    const isValid = this.rowData.every((item) => item.incidenceDate && item.idBonus);
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
this.cleanedListData = [];

const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      const date = new Date(cleanedData.incidenceDate);

      const year = date.getFullYear();
      const month = ('0' + (date.getMonth() + 1)).slice(-2);
      const day = ('0' + date.getDate()).slice(-2);

      cleanedData.incidenceDate = `${year}-${month}-${day}T00:00:00`;
      console.log('DATOS', cleanedData);
      if (cleanedData != null) this.cleanedListData.push(cleanedData);
      console.log('Datos por añadir', this.cleanedListData);
      return this.administrationService.addEmployeesBonus(this.cleanedListData);
    });
    
    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row); // Solo una vez

      // Formatear fecha
      const date = new Date(cleanedData.incidenceDate);
      const year = date.getFullYear();
      const month = ('0' + (date.getMonth() + 1)).slice(-2);
      const day = ('0' + date.getDate()).slice(-2);
      cleanedData.incidenceDate = `${year}-${month}-${day}T00:00:00`;

      // Log y push
      console.log('DATOS LIMPIOS POR ACTUALIZAR: ', cleanedData);
      if (cleanedData != null) this.cleanedListData.push(cleanedData);
    console.log(row.id,cleanedData)
      return this.administrationService.updateEmployeesBonus(
        row.id,
        cleanedData
      );
    });


    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      // Determinar qué ID vamos a seleccionar después de recargar
      if (modifiedRows.length > 0) {
        this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
      } else if (newRows.length > 0) {
        this.lastEditedRowId = 'SELECT_MAX_ID';
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];

      // Esperar a que los datos se carguen completamente
      await this.obtenerBonos();

      // Esperar un ciclo de renderizado adicional
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Seleccionar la fila apropiada después de recargar
      if (this.lastEditedRowId) {
        if (this.lastEditedRowId === 'SELECT_MAX_ID') {
          // Encontrar el ID máximo en los datos actuales
          const maxId = Math.max(...this.rowData.map((row) => Number(row.id)));
          this.selectRowById(maxId);
        } else {
          this.selectRowById(this.lastEditedRowId);
        }
        this.lastEditedRowId = null;
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
  revertMasterData() {
    this.obtenerBonos();
    this.notSavedChanges = false;
  }

  private validateRequiredField(value: any): any {
    return {
      backgroundColor: !value ? '#fff3cd' : 'transparent',
      border: !value ? '2px solid #ff9966' : 'none',
    };
  }
    private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    if (data.bonus == 'N/A') {
      return null;
    }
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
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

  onMasterSelectionChanged(event: any) {}

  onMasterCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onMasterGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  
  onMasterRowSelected(event: any) {
    this.id = event.data.id;
  }

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    groupDefaultExpanded: -1, // -1 significa expandir todos los niveles
    suppressDragLeaveHidesColumns: true,
    suppressMakeColumnVisibleAfterUnGroup: true,
    rowBuffer: 20,
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
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
  };
  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
      const colId = event.column.getColId();
      const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
      const selectedId = selectedRowData.id; // Obtener el ID del registro
  
      this.notSavedChanges = true;
  
      // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
      //this.selectedRowData = selectedRowData;
    }

    
}