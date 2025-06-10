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
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ClockService } from 'app/services/clock.service';
import { TimeEditorComponent } from 'app/shared/time-editor/time-editor.component';
import { TimeEditorModule } from 'app/shared/time-editor/time-editor.module';
import { lastValueFrom, concat, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { EmployeesService } from 'app/services/employees.service';

declare var bootstrap: any;

@Component({
  selector: 'app-detail-clock-2',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, TimeEditorModule, ReactiveFormsModule, CommonModule],
  templateUrl: './detail-clock-2.component.html',
  styleUrl: './detail-clock-2.component.scss',
})
export default class DetailClock2Component implements OnInit {
  private clockService = inject(ClockService);
  private signalsService = inject(SignalsService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private employeesService = inject(EmployeesService);

  ngOnInit() {
    this.idEmployee = this.signalsService.getDetailClockForEmployee().idEmployee();
    this.fechaInicio = this.signalsService.getDetailClockForEmployee().startDate();
    this.fechaFin = this.signalsService.getDetailClockForEmployee().endDate();
    this.obtenerDatos(this.idEmployee, this.fechaInicio, this.fechaFin);
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerCatalogoAusencias(this.idCompany);
    this.obtenerCatalogoAusenciasVigente(this.idCompany);

    // Inicializar el formulario de justificantes
    this.justificanteForm = this.fb.group({
      fecha: [this.getLocalDate(), Validators.required],
      justificante: ['', Validators.required]
    });

    // Suscribirse a los cambios de fecha para actualizar el día de la semana
    this.justificanteForm.get('fecha')?.valueChanges.subscribe(fecha => {
      this.actualizarDiaSemana(fecha);
    });

    // Suscribirse a los cambios del formulario completo
    this.justificanteForm.valueChanges.subscribe(values => {
      console.log('Estado actual del formulario:', values);
    });

    // Inicializar el día de la semana con la fecha actual
    this.actualizarDiaSemana(this.getLocalDate());
  }

  constructor() {
    effect(() => {
      this.idEmployee = this.signalsService.getDetailClockForEmployee().idEmployee();
      this.fechaInicio = this.signalsService.getDetailClockForEmployee().startDate();
      this.fechaFin = this.signalsService.getDetailClockForEmployee().endDate();
      console.log(this.idEmployee, this.fechaInicio, this.fechaFin);
      this.obtenerDatos(this.idEmployee, this.fechaInicio, this.fechaFin);
    });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerDatos(this.idEmployee, this.fechaInicio, this.fechaFin);
    });

    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerCatalogoAusencias(this.idCompany);
      this.obtenerCatalogoAusenciasVigente(this.idCompany);
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
  gridHeight: string = '55vh';
  showCreditsTab: boolean = false;
  private gridApi: GridApi;
  notSavedChanges: boolean = false;
  selectedRowData: any = null;
  isOpen: boolean = false;
  branchs: any[] = [];
  Typecop: any[] = [];
  idCompany: number;
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
  catalogoAusencias: any[] = [];
  catalogoAusenciasVigente: any[] = [];

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
    suppressAggFuncInHeader: true,
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
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          return `${day}-${month}-${year}`;
        },
        valueParser: (params) => {
          if (!params.newValue) return null;
          const [day, month, year] = params.newValue.split('-');
          return `${year}-${month}-${day}`;
        },
        rowGroup: true,
      },
      {
        field: 'checkTime',
        headerName: 'Hora de Registro',
        editable: true,
        cellEditor: 'timeEditor',
        width: 200,
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
        width: 200,
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
        }
      },

      {
        headerName: 'Horas Laboradas',
        field: 'hoursWorked',
        editable: false,
        width: 200,
        cellRenderer: (params) => {
          if (params.node.group) {
            const groupData = params.node.allLeafChildren;
            let totalHours = 0;
            let totalDiscountHours = 0; // Acumulador de descuentos
            let lastInTime = null;

            // Filtrar y ordenar registros válidos por hora
            const validRecords = [...groupData]
              .filter(node =>
                node.data.valid === true &&
                node.data.checkTime
              )
              .sort((a, b) =>
                a.data.checkTime.localeCompare(b.data.checkTime)
              );

            // 1. Calcular horas trabajadas
            for (const node of validRecords) {
              const record = node.data;
              if (record.type === 'IN') {
                lastInTime = record.checkTime;
              } else if (record.type === 'OUT' && lastInTime) {
                totalHours += this.calculateTimeDifference(
                  lastInTime,
                  record.checkTime
                );
                lastInTime = null;
              }
            }

            // 2. Calcular descuentos totales del día
            const discountMinutes = validRecords.reduce((sum, node) => {
              const record = node.data;
              // Solo considerar registros con minuteDiscount válido
              if (record.minuteDiscount !== null &&
                record.minuteDiscount !== undefined &&
                !isNaN(record.minuteDiscount)) {
                return sum + Number(record.minuteDiscount);
              }
              return sum;
            }, 0);

            totalDiscountHours = discountMinutes / 60;

            // 3. Aplicar descuento
            const netHours = totalHours - totalDiscountHours;

            // Formatear resultado neto
            return this.formatHours(netHours);
          }
          return null;
        },
        hide: false,
        valueGetter: () => null,
        aggFunc: 'sum',
      },
      {
        headerName: 'Retardos',
        field: 'delays',
        editable: false,
        width: 200,
        cellRenderer: (params) => {
          if (params.node.group) {
            const groupData = params.node.allLeafChildren;

            // Contar registros con minuteDiscount > 0
            const delaysCount = [...groupData].filter(node => {
              const record = node.data;
              return record.valid === true &&
                record.minuteDiscount !== null &&
                record.minuteDiscount !== undefined &&
                Number(record.minuteDiscount) > 0;
            }).length;

            return delaysCount.toString();
          }
          return null;
        },
        hide: false,
        valueGetter: () => null,
        aggFunc: 'sum',
      },
      {
        headerName: 'Salidas pendientes',
        field: 'pendingExits',
        editable: false,
        width: 150,
        enableValue: false,
        cellRenderer: (params) => {
          if (params.node.group) {
            const groupData = params.node.allLeafChildren;

            // Contar registros válidos de tipo IN
            const validInCount = [...groupData].filter(node => {
              const record = node.data;
              return record.valid === true && record.type === 'IN';
            }).length;

            // Contar registros válidos de tipo OUT
            const validOutCount = [...groupData].filter(node => {
              const record = node.data;
              return record.valid === true && record.type === 'OUT';
            }).length;

            // Calcular la diferencia (no permitir valores negativos)
            const pendingExits = Math.max(0, validInCount - validOutCount);

            return pendingExits.toString();
          }
          return null;
        },
        hide: false,
        valueGetter: () => null,
        aggFunc: 'sum',
      },
      {
        field: 'valid',
        headerName: 'Válido',
        editable: true,
        width: 100
      },
      {
        headerName: 'Faltas',
        field: 'absences',
        editable: false,
        width: 200,
        cellRenderer: (params) => {
          if (params.node.group) {
            const groupData = params.node.allLeafChildren;

            // Verificar si hay al menos un registro tipo IN con valid: false
            const hasAbsence = [...groupData].some(node => {
              const record = node.data;
              return record.type === 'IN' && record.valid === false;
            });

            return hasAbsence ? '1' : '0';
          }
          return null;
        },
        hide: false,
        valueGetter: () => null,
        aggFunc: 'sum',
      },
      {
        field: 'idReason',
        headerName: 'Razón de justificación de falta',
        editable: true,
        width: 200,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.catalogoAusencias.map(item => item.id.toString()),
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const ausencia = this.catalogoAusencias.find(item => item.id.toString() === params.value.toString());
          return ausencia ? ausencia.description : '';
        },
        valueParser: (params) => {
          return params.newValue;
        }
      },
      {
        field: 'minuteDiscount',
        headerName: 'Minutos Descontados',
        editable: true,
        cellDataType: 'number',
        cellEditor: 'agTextCellEditor',
        width: 200,
      },
      {
        field: 'minuteDiscountBackup',
        headerName: 'Minutos Descontados Respaldo',
        editable: false,
        cellDataType: 'number',
        cellEditor: 'agTextCellEditor',
        width: 250,
      },
      {
        field: 'edited',
        headerName: 'Editado',
        editable: false,
        width: 100
      },
      {
        field: 'byTimeClock',
        headerName: 'Checador?',
        editable: false,
        width: 150
      },
      {
        field: 'editedBy',
        headerName: 'Editado por',
        editable: false,
        width: 200,
      },
    ];
  }

  obtenerCatalogoAusencias(idCompany: number) {
    this.clockService.getCatalogsAbsences(idCompany).subscribe((data: any) => {
      this.catalogoAusencias = data;
    });
  }

  obtenerCatalogoAusenciasVigente(idCompany: number) {
    this.clockService.getCatalogsAbsencesVigente(idCompany).subscribe((data: any) => {
      this.catalogoAusenciasVigente = data;
    });
  }

  obtenerDatos(idEmployee: number, fechaInicio: string, fechaFin: string) {
    this.clockService
      .checkInOutByEmployee(idEmployee, fechaInicio, fechaFin)
      .subscribe((data: any) => {
        this.rowData = [];
        this.rowData = data;
        // Esperar a que el grid se actualice y luego ajustar las columnas
        setTimeout(() => {
          if (this.gridApi) {
            // Obtener todas las columnas y ajustarlas automáticamente
            const allColumnIds = this.gridApi.getColumns().map(column => column.getColId());
            this.gridApi.autoSizeColumns(allColumnIds);
            // Forzar un redraw del grid para asegurar que los cambios se apliquen
            this.gridApi.redrawRows();
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
      if (!event.data.modifiedCheckTime && event.data.byTimeClock) {
        event.data.modifiedCheckTime = event.oldValue;
      }
      // Si ya existe un valor en modifiedCheckTime, este no se cambia
    }
    if (event.column.getColId() === 'minuteDiscount') {
      if (!event.data.minuteDiscountBackup && event.data.byTimeClock) {
        event.data.minuteDiscountBackup = event.oldValue;
      }
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
      minuteDiscountBackup: null,
      edited: true,
      byTimeClock: false,
      idReason: null,
      editedBy: this.signalsService.getDisplayName()(),
      active: true,
      __isNew: true, // Marca la fila como nueva
    };

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
    const isValid = this.rowData.every((item) => item.date && item.checkTime);
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

      await this.obtenerDatos(this.idEmployee, this.fechaInicio, this.fechaFin); // Esperar a que se actualicen los datos

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
    this.obtenerDatos(this.idEmployee, this.fechaInicio, this.fechaFin);
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
      // Asegurarse de que date sea una cadena de texto y extraer solo la parte de la fecha
      let dateStr = typeof cleanedData.date === 'string' ? cleanedData.date : new Date(cleanedData.date).toISOString();
      dateStr = dateStr.split('T')[0]; // Solo tomar la parte de la fecha

      // Asegurarse de que checkTime tenga el formato correcto (HH:MM:SS)
      const formattedCheckTime = cleanedData.checkTime.includes('.')
        ? cleanedData.checkTime.split('.')[0]
        : cleanedData.checkTime;

      cleanedData.timeStamp = `${dateStr}T${formattedCheckTime}`;
    }

    // Añadir modifiedTimeStamp como concatenación de date y modifiedCheckTime
    if (cleanedData.date && cleanedData.modifiedCheckTime) {
      // Asegurarse de que date sea una cadena de texto y extraer solo la parte de la fecha
      let dateStr = typeof cleanedData.date === 'string' ? cleanedData.date : new Date(cleanedData.date).toISOString();
      dateStr = dateStr.split('T')[0]; // Solo tomar la parte de la fecha

      // Asegurarse de que modifiedCheckTime tenga el formato correcto (HH:MM:SS)
      const formattedModifiedCheckTime = cleanedData.modifiedCheckTime.includes('.')
        ? cleanedData.modifiedCheckTime.split('.')[0]
        : cleanedData.modifiedCheckTime;

      cleanedData.timeStampBackup = `${dateStr}T${formattedModifiedCheckTime}`;
    }
    delete cleanedData.date;
    delete cleanedData.checkTime;
    delete cleanedData.modifiedCheckTime;
    return cleanedData;
  }

  // Agregar esta función auxiliar para calcular diferencia horaria
  private calculateTimeDifference(start: string, end: string): number {
    const startParts = start.split(':').map(Number);
    const endParts = end.split(':').map(Number);

    const startDate = new Date(0, 0, 0, startParts[0], startParts[1], startParts[2] || 0);
    const endDate = new Date(0, 0, 0, endParts[0], endParts[1], endParts[2] || 0);

    let diff = endDate.getTime() - startDate.getTime();
    if (diff < 0) {
      diff += 24 * 60 * 60 * 1000; // Ajuste para tiempos que cruzan medianoche
    }
    return diff / 1000 / 60 / 60; // Convertir a horas
  }

  private formatHours(totalHours: number): string {
    if (totalHours < 0) totalHours = 0; // Evitar valores negativos

    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Propiedades para el modal de justificantes
  justificanteForm: FormGroup;
  diaSemana: string = '';

  // Método para obtener el día de la semana en español
  private actualizarDiaSemana(fecha: string) {
    const diasSemana = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado'
    ];
    
    // Parsear la fecha asegurándonos de que se interprete en la zona horaria local
    const [year, month, day] = fecha.split('-').map(Number);
    const fechaObj = new Date(year, month - 1, day);
    this.diaSemana = diasSemana[fechaObj.getDay()];
  }

  // Método para obtener la fecha local en formato YYYY-MM-DD
  private getLocalDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Método para confirmar la adición del justificante
  confirmarAnadir() {
    if (this.justificanteForm.valid) {
      // Capturar los valores del formulario antes de cualquier otra operación
      const formValues = { ...this.justificanteForm.value };
      console.log('Valores capturados del formulario:', formValues);

      alerts.confirmAlert(
        'Confirmar',
        '¿Está seguro que desea añadir estos datos al sistema?',
        'warning',
        'Sí, añadir'
      ).then((result) => {
        if (result.isConfirmed) {
          console.log('Datos del formulario:', formValues);
          
          this.employeesService.getEmployeeClockByDay(this.idEmployee, this.diaSemana).subscribe((data: any) => {
            const employee = data[0];
            console.log('Datos del empleado:', employee);

            if (employee && employee.enabled) {
              const fecha = formValues.fecha;
              const idReason = formValues.justificante;
              console.log('Valor del justificante seleccionado:', idReason);
              console.log('Tipo del valor del justificante:', typeof idReason);

              if (!idReason) {
                alerts.basicAlert(
                  'Error',
                  'Debe seleccionar un justificante',
                  'error'
                );
                return;
              }

              const nuevasFilas = [];

              // Crear fila para entry1
              const filaEntry1 = {
                id: `temp_${this.tempIdCounter++}`,
                idEmployee: this.idEmployee,
                idBranch: this.idBranch,
                date: fecha,
                checkTime: employee.entry1,
                modifiedCheckTime: '',
                type: 'IN',
                valid: false,
                minuteDiscount: 0,
                minuteDiscountBackup: null,
                edited: true,
                byTimeClock: false,
                idReason: Number(idReason),
                editedBy: this.signalsService.getDisplayName()(),
                active: true,
                __isNew: true
              };
              console.log('Fila entry1 creada:', filaEntry1);
              nuevasFilas.push(filaEntry1);

              // Crear fila para exit1
              const filaExit1 = {
                id: `temp_${this.tempIdCounter++}`,
                idEmployee: this.idEmployee,
                idBranch: this.idBranch,
                date: fecha,
                checkTime: employee.exit1,
                modifiedCheckTime: '',
                type: 'OUT',
                valid: false,
                minuteDiscount: 0,
                minuteDiscountBackup: null,
                edited: true,
                byTimeClock: false,
                idReason: Number(idReason),
                editedBy: this.signalsService.getDisplayName()(),
                active: true,
                __isNew: true
              };
              console.log('Fila exit1 creada:', filaExit1);

              // Si existen entry2 y exit2, crear filas adicionales
              if (employee.entry2 && employee.exit2) {
                // Crear fila para entry2
                const filaEntry2 = {
                  id: `temp_${this.tempIdCounter++}`,
                  idEmployee: this.idEmployee,
                  idBranch: this.idBranch,
                  date: fecha,
                  checkTime: employee.entry2,
                  modifiedCheckTime: '',
                  type: 'IN',
                  valid: false,
                  minuteDiscount: 0,
                  minuteDiscountBackup: null,
                  edited: true,
                  byTimeClock: false,
                  idReason: Number(idReason),
                  editedBy: this.signalsService.getDisplayName()(),
                  active: true,
                  __isNew: true
                };
                console.log('Fila entry2 creada:', filaEntry2);
                nuevasFilas.push(filaEntry2);

                // Crear fila para exit2
                const filaExit2 = {
                  id: `temp_${this.tempIdCounter++}`,
                  idEmployee: this.idEmployee,
                  idBranch: this.idBranch,
                  date: fecha,
                  checkTime: employee.exit2,
                  modifiedCheckTime: '',
                  type: 'OUT',
                  valid: false,
                  minuteDiscount: 0,
                  minuteDiscountBackup: null,
                  edited: true,
                  byTimeClock: false,
                  idReason: Number(idReason),
                  editedBy: this.signalsService.getDisplayName()(),
                  active: true,
                  __isNew: true
                };
                console.log('Fila exit2 creada:', filaExit2);
                nuevasFilas.push(filaExit2);
              }

              // Añadir las nuevas filas al grid
              console.log('Filas que se añaden al grid:', nuevasFilas);
              this.rowData = [...nuevasFilas, ...this.rowData];
              this.gridApi.setGridOption('rowData', this.rowData);
              this.notSavedChanges = true;
            }
          });
          
          // Cerrar el modal
          const modalElement = document.getElementById('addJustificanteModal');
          const modal = bootstrap.Modal.getInstance(modalElement);
          if (modal) {
            modal.hide();
          }
          
          // Resetear el formulario
          this.justificanteForm.reset({
            fecha: this.getLocalDate(),
            justificante: ''
          });
        }
      });
    } else {
      alerts.basicAlert(
        'Error',
        'Por favor complete todos los campos requeridos',
        'error'
      );
    }
  }
}