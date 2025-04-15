import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import * as bootstrap from 'bootstrap';
import { alerts } from '../../../../../../../helpers/alerts';
import { catchError, concat, EMPTY, lastValueFrom, toArray, throwError } from 'rxjs';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { CommonModule } from '@angular/common';
import { AdministrationService } from 'app/services/administration.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-bonus',
  standalone: true,
  imports: [AgGridModule, FormsModule, ReactiveFormsModule, CommonModule, MultiLineEditorComponent],
  templateUrl: './bonus.component.html',
})
export class BonusComponent{

  private signalsService = inject(SignalsService);
  private catalogsService = inject(CatalogsService);
  private administrationService = inject(AdministrationService);
  private gridApi: GridApi;

  components = {
      multiLineEditor: MultiLineEditorComponent,
      autocompleteEditor: AutocompleteEditorComponent,
    };

  id: string;
  rowData: any;
  //bonusForm!: FormGroup;
  selectFechas!: FormGroup;
  idEmployee: number;
  nameEmployee: string;
  bonoEmployee: number;
  idBranch: number;
  bonusCatalogos: any[] = [];
  fechaInicio: string;
  isOpen: boolean = false;
  fechaFin: string;
  employee: any;
  idEmpresa: number;
  notSavedChanges: boolean = false;
  gridHeight: string = '75vh';
  showCreditsTab: boolean = false;
  selectedRowData: any = null;
  private lastEditedRowId: number | string | null = null;
  newlyAddedRows: string[] = [];
  cleanedListData: any[] = [];
  incidentDate : string;


  ngOnInit(){
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.idEmpresa = this.signalsService.getRootSelectedBySidebar()();
    //console.log("en init, esto es bonusCatalog:cdfdd ", this.bonusCatalogos);
    this.obtenerDatosCatalogos();
    //console.log("en init pasada la llamada, esto es bonusCatalog: ", this.bonusCatalogos);
    this.InicioConsulta();
    this.selectFechas = this.fb.group({
      fechaInicio: [this.fechaInicio, Validators.required],
      fechaFin: [this.fechaFin, Validators.required]
    });
  }
  constructor(private fb: FormBuilder){}

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

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  obtenerDatosCatalogos() {
    //console.log("------- empresa para obtener catalogos: ", this.idEmpresa);
    this.catalogsService.getCatalogs(this.idEmpresa , "BONUS").subscribe((data) => {
      this.bonusCatalogos = data;
      //console.log("------ Catalogo", data);
    },
      (error) => console.error('Error fetching measures:', error)
    );
  }

  obtenerBonosEmpleados(){
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    console.log("Consulta: ", this.fechaInicio, this.fechaFin, this.idBranch)
    this.administrationService.getEmployeesBonus(this.fechaInicio, this.fechaFin, this.idBranch).subscribe({
      next: (data) => {
        this.rowData = data;
        //console.log("----- Datos de bonos: ", data)
      },
      error: (err) => {
        console.error("Error al obtener empleados con bonus:", err);
      }
    });
  }

  get colMaster(): ColDef[] {
    return[
    {
      field: 'idEmployee',
      headerName: 'Id empleado',
      editable: false,
      filter: true,
      width: 200,
      flex: 1,
    },
    {
      field: 'employeeName',
      headerName: 'Nombre',
      editable: false,
      filter: true,
      width: 200,
      flex: 1,
    },
    {
      field: 'incidenceDate',
      headerName: 'Fecha',
      editable: true,
      filter: true,
      width: 200,
      flex: 1,
      cellEditor: 'agDateCellEditor',

      valueGetter: (params) => params.data.incidenceDate ? new Date(params.data.incidenceDate) : null,

      valueFormatter: (params) => {
        if (params.value) {
          const date = new Date(params.value);
          this.incidentDate = `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
          return this.incidentDate;
        }
        return '';
      }


    },
    {
      field: 'bonus',
      headerName: 'Concepto',
      editable: true,
      filter: true,
      width: 150,
      flex: 1,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: this.bonusCatalogos ? this.bonusCatalogos.map(item => item.description) : [],
      },
      valueFormatter: (params) => {
        const foundItem = this.bonusCatalogos ? this.bonusCatalogos.find(item => item.description === params.value) : null;
        return foundItem ? `${foundItem.description}` : params.value;
      }
    },
    {
      field: 'quantity',
      headerName: 'Monto',
      editable: false,
      filter: false,
      flex: 1,
     /*  valueGetter: (params) => {
        const foundItem = this.bonusCatalogos ? this.bonusCatalogos.find(item => item.description === params.data.bonus) : null;
        return foundItem ? foundItem.valueAddition : '';
      } */
      valueFormatter: (params) => {
        const foundItem = this.bonusCatalogos?.find(item => item.description === params.data.bonus);
        const value = foundItem ? foundItem.valueAddition : params.value;
        return value ? `$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '';
      }
    }
  ]}
  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
    if (event.colDef.field === 'bonus') {
      const selectedBonus = event.newValue;
      const bonusInfo = this.bonusCatalogos?.find(item => item.description === selectedBonus);

      if (bonusInfo) {
        // Actualizamos el monto (quantity)
        event.data.quantity = parseFloat(bonusInfo.valueAddition);
        event.api.refreshCells({ rowNodes: [event.node], columns: ['quantity'] });
      }
    }
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

  async saveChanges(){
    console.log("---- salvando cambios ", this.rowData);
    /*const isValid = this.rowData.every((item) => item.nameContact || item.company);
        if (!isValid) {
          alerts.basicAlert(
            'Añadir entrada',
            'Debe llenar todos los campos antes de guardar.',
            'error'
          );
          return;
        }*/

        const newRows = this.rowData.filter((row) => row.__isNew);
        const modifiedRows = this.rowData.filter(
          (row) => row.__modified && !row.__isNew
        );

        const addObservables = newRows.map((row) => {
          const cleanedData = this.cleanDataForServer(row);
          console.log(cleanedData);
          return this.administrationService.addEmployeesBonus([]);
        });

        const updateObservables = modifiedRows.map((row) => {
          const cleanedData = this.cleanDataForServer(row);
          console.log('Actualizando cliente con los siguientes datos:', cleanedData);
          this.cleanedListData.push(cleanedData);
          console.log('Actualizando arrys de empleados: ', this.cleanedListData);

          return this.administrationService.addEmployeesBonus(this.cleanedListData);
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
          await this.obtenerBonosEmpleados();

          // Esperar un ciclo de renderizado adicional
          await new Promise(resolve => setTimeout(resolve, 0));

          // Seleccionar la fila apropiada después de recargar
          if (this.lastEditedRowId) {
            if (this.lastEditedRowId === 'SELECT_MAX_ID') {
              // Encontrar el ID máximo en los datos actuales
              const maxId = Math.max(...this.rowData.map(row => Number(row.id)));
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

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.signalsService.setIdClient(this.selectedRowData.id);
      this.signalsService.setNameClient(this.selectedRowData.company);
    } else {
      this.selectedRowData = null;
    }
  }


  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    //this.signalsService.setProviderOrCustomer(this.type);
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

    // Filtrar el grid para mostrar solo el registro con el ID seleccionado solo si la columna es "total"
    if (colId === 'total') {
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };

      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
      this.activateCreditsTab(); // Activar la pestaña de créditos si es necesario
    }

    this.selectedRowData = selectedRowData; // Guardar los datos seleccionados
  }
  async activateCreditsTab() {
    if (!this.isOpen) {
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

  revert(){
    this.obtenerBonosEmpleados();
    this.notSavedChanges = false;
  }

  onRowDoubleClicked(event: any) {
    /*this.bonusForm.reset({
      nuevoBonus: '',
      motivo: ''
    });
    this.idEmployee = event.data.id;
    this.nameEmployee = event.data.name;
    this.bonoEmployee = event.data.bono;

    const modal = new bootstrap.Modal(document.getElementById('searchModal')!);
    modal.show();*/
  }
  /*guardarBonus(){
    if (this.bonusForm.valid) {
      const datos = this.bonusForm.value;
      console.log('Bonus actualizado:', {
        id: this.idEmployee,
        nombre: this.nameEmployee,
        bonusAnterior: this.bonoEmployee,
        nuevoBonus: datos.nuevoBonus,
        motivo: datos.motivo,
        fecha: datos.fechaSelect
      });
    }
  }*/

    Consultar(){
      if(this.selectFechas.valid){
        const datos = this.selectFechas.value;
        this.fechaInicio = datos.fechaInicio;
        this.fechaFin = datos.fechaFin;
        this.obtenerBonosEmpleados()
      }
    }

    InicioConsulta(){
      const hoy = new Date();
      const semanaActual = this.getWeekNumber(hoy);
      const semanaPasada = semanaActual - 1;
      const añoActual = hoy.getFullYear();
      //const Lunes  = this.getDateOfISOWeek(semanaActual, añoActual, 1);
      const Sabado = this.getDateOfISOWeek( semanaPasada, añoActual, 6);
      //console.log("El sabado de la semana pasada fue: ", Sabado.toISOString().split('T')[0],"Y el lunes es:",Lunes.toISOString().split('T')[0]);
      this.fechaInicio = Sabado.toISOString().split('T')[0];
      this.fechaFin = hoy.toISOString().split('T')[0];
      this.obtenerBonosEmpleados()
    }
  
    getDateOfISOWeek(week: number, year: number, dayOfWeek: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const ISOWeekStart = simple;
    
    if (dow <= 4)
      ISOWeekStart.setDate(simple.getDate() - simple.getDay() + 1); // lunes
    else
      ISOWeekStart.setDate(simple.getDate() + 8 - simple.getDay()); // siguiente lunes
  
    const result = new Date(ISOWeekStart);
    result.setDate(result.getDate() + dayOfWeek - 1); // lunes = 1, viernes = 5
    return result;
  }
  
  getWeekNumber(fecha: Date): number {
    const fechaCopy = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const diaSemana = fechaCopy.getUTCDay() || 7; // Domingo = 7
    fechaCopy.setUTCDate(fechaCopy.getUTCDate() + 4 - diaSemana); // Ajustar al jueves
    const añoInicio = new Date(Date.UTC(fechaCopy.getUTCFullYear(), 0, 1));
    const diferencia = fechaCopy.getTime() - añoInicio.getTime();
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
    return Math.ceil((dias + 1) / 7);
  }
}
