import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../../helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { PayrollService } from 'app/services/payroll.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClockService } from 'app/services/clock.service';
import { TimeEditorComponent } from 'app/shared/time-editor/time-editor.component';
import { TimeEditorModule } from 'app/shared/time-editor/time-editor.module';
import { lastValueFrom, concat, toArray } from 'rxjs';

@Component({
  selector: 'app-detail-clock-2',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, TimeEditorModule],
  templateUrl: './detail-clock-2.component.html',
  styleUrl: './detail-clock-2.component.scss',
})
export default class DetailClock2Component implements OnInit {
  private clockService = inject(ClockService);
  private signalsService = inject(SignalsService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  ngOnInit() {
    //this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.idEmployee = 443;

    this.fechaInicio = '2025-04-19';
    this.fechaFin = '2025-04-25';
    this.obtenerDatos(this.fechaInicio, this.fechaFin);
  }

  constructor() {
    this.selectFechas = this.fb.group({
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required],
    });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerDatos(this.fechaInicio, this.fechaFin);
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  selectFechas: FormGroup;
  type: string = '';
  gridHeight: string = '75vh';
  showCreditsTab: boolean = false;
  private gridApi: GridApi;
  notSavedChanges: boolean = false;
  selectedRowData: any = null;
  isOpen: boolean = false;
  branchs: any[] = [];
  Typecop: any[] = [];
  tempIdCounter: number = 0; // Contador para IDs temporales

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;

  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];

  id: string;
  idBranch: number;
  selectedTab: string = 'customers-payments';
  idEmployee: number;
  fechaInicio: any;
  fechaFin: any;

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
    timeEditor: TimeEditorComponent,
  };

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    groupDefaultExpanded: -1, // -1 significa expandir todos los grupos
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

  get colDetail(): ColDef[] {
    return [
      {
        field: 'id',
        headerName: 'ID',
        editable: true,
        width: 80,
        hide: true,
      },
      {
        field: 'idEmployee',
        headerName: 'ID Empleado',
        editable: true,
        width: 110,
        hide: true,
      },
      {
        field: 'idBranch',
        headerName: 'ID Sucursal',
        editable: true,
        width: 110,
        hide: true,
      },
      {
        field: 'date',
        headerName: 'Fecha',
        editable: true,
        cellEditor: 'agDateCellEditor',
        width: 120,
        valueFormatter: (params) => {
          if (!params.value) return '';
          const date = new Date(params.value);
          return date.toISOString().split('T')[0];
        },
        rowGroup: true,
      },
      {
        field: 'checkTime',
        headerName: 'Hora de Registro',
        editable: true,
        cellEditor: 'timeEditor',
        width: 120,
        valueFormatter: (params) => {
          if (!params.value) return '';
          return params.value.split('.')[0];
        },
      },
      {
        field: 'modifiedCheckTime',
        headerName: 'Hora de Registro Respaldo',
        editable: false,
        cellEditor: 'timeEditor',
        width: 120,
        valueFormatter: (params) => {
          if (!params.value) return '';
          return params.value.split('.')[0];
        },
      },
      {
        field: 'type',
        headerName: 'Tipo',
        editable: true,
        width: 100,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['IN', 'OUT'],
        },
        valueFormatter: (params) => {
          if (params.node.group) return '';
          return params.value === 'OUT' ? 'Salida' : 'Entrada';
        },
      },
      {
        field: 'valid',
        headerName: 'Válido',
        editable: true,
        width: 100,
        valueFormatter: (params) => {
          if (params.node.group) return '';
          return params.value ? 'Sí' : 'No';
        },
        cellStyle: (params) => {
          if (params.node.group) return null;
          if (!params.value) {
            return { backgroundColor: '#ffcccc' };
          }
          return null;
        },
      },
      {
        field: 'minuteDiscount',
        headerName: 'Minutos Descontados',
        editable: true,
        cellDataType: 'number',
        cellEditor: 'agTextCellEditor',
        width: 150,
      },
      {
        field: 'edited',
        headerName: 'Editado',
        editable: false,
        width: 100,
        valueFormatter: (params) => {
          return params.value ? 'Sí' : 'No';
        },
      },
      {
        field: 'comments',
        headerName: 'Comentarios',
        editable: true,
        width: 200,
      },
      {
        field: 'editedBy',
        headerName: 'Editado por',
        editable: false,
        width: 200,
      },
    ];
  }

  obtenerDatos(
    fechaInicio: string = '2025-04-19',
    fechaFin: string = '2025-04-25'
  ) {
    this.clockService
      .checkInOutByEmployee(this.idEmployee, fechaInicio, fechaFin)
      .subscribe((data: any) => {
        this.rowData = [];
        this.rowData = data;
        // Esperar a que el grid se actualice y luego ajustar las columnas
        setTimeout(() => {
          if (this.gridApi) {
            this.gridApi.sizeColumnsToFit();
          }
        }, 100);
      });
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      console.log(
        'ID del empleado seleccionado:',
        this.selectedRowData.idEmployee
      );
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    event.data.edited = true;
    event.data.editedBy = this.signalsService.getDisplayName()();
    this.notSavedChanges = true;
    this.lastEditedRowId = event.data.id;

    // Si se está editando el campo checkTime
    if (event.column.getColId() === 'checkTime') {
      // Si modifiedCheckTime está vacío, guardamos el valor original
      if (!event.data.modifiedCheckTime) {
        event.data.modifiedCheckTime = event.oldValue;
      }
      // Si ya existe un valor en modifiedCheckTime, este no se cambia
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
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

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    this.signalsService.setProviderOrCustomer(this.type);
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

    console.log('Datos ShowCredits:', this.showCreditsTab);
    this.selectedRowData = selectedRowData; // Guardar los datos seleccionados
  }

  async activateCreditsTab() {
    if (!this.isOpen) {
      setTimeout(async () => await this.adjustGridSize(), 0);
      this.showCreditsTab = true;
      this.isOpen = true;
    } else {
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

  Consultar() {
    if (this.selectFechas.valid) {
      const datos = this.selectFechas.value;
      this.fechaInicio = datos.fechaInicio;
      this.fechaFin = datos.fechaFin;
      console.log(this.fechaInicio, this.fechaFin);
      this.obtenerDatos(this.fechaInicio, this.fechaFin);
    } else {
      alerts.basicAlert('Error', 'Por favor selecciona ambas fechas', 'error');
    }
  }

  addDetailRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idEmployee: this.idEmployee,
      idBranch: this.idBranch,
      date: new Date().toISOString().split('T')[0],
      checkTime: '',
      modifiedCheckTime: '',
      type: 'IN',
      valid: true,
      minuteDiscount: 0,
      edited: true,
      comments: '',
      editedBy: this.signalsService.getDisplayName()(),
      active: true,
      __isNew: true, // Marca la fila como nueva
    }

    // Actualizar el estado
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);

    // Encontrar la primera columna editable
    const firstEditableCol = this.colDetail.find((col) => col.editable);
    const firstEditableColKey = firstEditableCol
      ? firstEditableCol.field
      : null;

    // Usar setTimeout para asegurar que el grid haya renderizado la nueva fila
    setTimeout(() => {
      if (firstEditableColKey) {
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: firstEditableColKey, // Editar la primera columna editable
        });
      }
    }, 50); // Un pequeño retraso de 50ms
  }

  async saveDetailChanges() {
    const isValid = this.rowData.every(
      (item) =>
        item.date &&
        item.checkTime
    );
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar los campos obligatorios antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    // Mostrar los datos de las filas nuevas que se van a enviar
    console.log('Filas nuevas que se van a enviar al servidor:');
    newRows.forEach((row, index) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(`Fila nueva ${index + 1}:`, cleanedData);
    });

    // Mostrar los datos de las filas modificadas que se van a enviar
    console.log('Filas modificadas que se van a enviar al servidor:');
    modifiedRows.forEach((row, index) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(`Fila modificada ${index + 1}:`, cleanedData);
    });

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.clockService.checkInOut(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.clockService.updateCheckInOut(row.id, cleanedData);
    });

    try {
      await lastValueFrom(
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

  revertDetailData() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.employeeName;
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.idBranch;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }

    // Añadir timeStamp como concatenación de date y checkTime
    if (cleanedData.date && cleanedData.checkTime) {
      // Asegurarse de que checkTime tenga el formato correcto (HH:MM:SS)
      const formattedCheckTime = cleanedData.checkTime.includes('.') 
        ? cleanedData.checkTime.split('.')[0] 
        : cleanedData.checkTime;
      
      cleanedData.timeStamp = cleanedData.date.split('T')[0]+ 'T' + formattedCheckTime;
    }

    // Añadir modifiedTimeStamp como concatenación de date y modifiedCheckTime
    if (cleanedData.date && cleanedData.modifiedCheckTime) {
      // Asegurarse de que modifiedCheckTime tenga el formato correcto (HH:MM:SS)
      const formattedModifiedCheckTime = cleanedData.modifiedCheckTime.includes('.') 
        ? cleanedData.modifiedCheckTime.split('.')[0] 
        : cleanedData.modifiedCheckTime;
      
      cleanedData.timeStampModified = cleanedData.date.split('T')[0]+ 'T' + formattedModifiedCheckTime;
    }
    delete cleanedData.date;
    delete cleanedData.checkTime;
    delete cleanedData.modifiedCheckTime;
    return cleanedData;
  }
}
