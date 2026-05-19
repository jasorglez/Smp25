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
import { TrackingService } from 'app/services/tracking.service';
import { AuthService } from 'app/services/auth.service';

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
  private trackingService = inject(TrackingService);
  authService = inject(AuthService);

  ngOnInit() {
    this.idEmployee = this.signalsService.getDetailClockForEmployee().idEmployee();
    this.fechaInicio = this.signalsService.getDetailClockForEmployee().startDate();
    this.fechaFin = this.signalsService.getDetailClockForEmployee().endDate();
    this.obtenerDatos(this.idEmployee, this.fechaInicio, this.fechaFin);
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerCatalogoAusencias(this.idCompany);
    this.obtenerCatalogoAusenciasVigente(this.idCompany);

    // Inicializar el formulario de justificantes
    this.diaInicio = this.getLocalDate();
    this.justificanteForm = this.fb.group({
      controlInicio: [this.diaInicio, Validators.required],
      controlFin: ['', Validators.required],
      justificante: ['', Validators.required]
    });

    // Suscribirse a los cambios de fecha para actualizar el día de la semana
    this.justificanteForm.get('controlInicio')?.valueChanges.subscribe(fecha => {
      this.diaSemanaInicio = this.obtenerNombreDiaSemana(fecha);
      this.diaInicio = fecha
    });

    this.justificanteForm.get('controlFin')?.valueChanges.subscribe(fecha => {
      this.diaSemanaFin = this.obtenerNombreDiaSemana(fecha);
      this.diaFin = fecha
    });


    // Suscribirse a los cambios del formulario completo
    this.justificanteForm.valueChanges.subscribe(values => {
    });

    // Inicializar el día de la semana con la fecha actual

  }

  constructor() {
    effect(() => {
      this.idEmployee = this.signalsService.getDetailClockForEmployee().idEmployee();
      this.fechaInicio = this.signalsService.getDetailClockForEmployee().startDate();
      this.fechaFin = this.signalsService.getDetailClockForEmployee().endDate();
      //console.log(this.idEmployee, this.fechaInicio, this.fechaFin);
      this.obtenerDatos(this.idEmployee, this.fechaInicio, this.fechaFin);
    });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerDatos(this.idEmployee, this.fechaInicio, this.fechaFin);
    });

    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerCatalogo(this.idCompany);
      this.obtenerCatalogoAusencias(this.idCompany);
      this.obtenerCatalogoAusenciasVigente(this.idCompany);
      this.obtenerCatalogoFestivo(this.idCompany);
      this.obtenerCatalogoFestivoVigente(this.idCompany);
    });
    this.diaInicio = this.getLocalDate();
    this.diaSemanaInicio = this.obtenerNombreDiaSemana(this.diaInicio);
    this.justificanteForm = this.fb.group({
      controlInicio: [this.diaInicio, Validators.required],
      controlFin: ['', Validators.required],
      justificante: ['', Validators.required]
    });
    this.justificanteForm.get('controlInicio')?.valueChanges.subscribe(fecha => {
      this.diaSemanaInicio = this.obtenerNombreDiaSemana(fecha);
      this.diaInicio = fecha
    });

    this.justificanteForm.get('controlFin')?.valueChanges.subscribe(fecha => {
      this.diaSemanaFin = this.obtenerNombreDiaSemana(fecha);
      this.diaFin = fecha
    });
    this.justificanteForm.valueChanges.subscribe(values => {
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
  gridHeight: string = '60vh';
  showCreditsTab: boolean = false;
  private gridApi: GridApi;
  notSavedChanges: boolean = false;
  selectedRowData: any = null;
  isOpen: boolean = false;
  branchs: any[] = [];
  Typecop: any[] = [];
  idCompany: number;
  tempIdCounter: number = 0; // Contador para IDs temporales

  // Propiedades para el modal de justificantes
  justificanteForm: FormGroup;
  diaSemana: string = '';
  diaSemanaInicio: string = '';
  diaSemanaFin: string = '';
  diaInicio: string = '';
  diaFin: string = '';

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
  catalogoAll: any[] = [];
  catalogoAusencias: any[] = [];
  catalogoAusenciasVigente: any[] = [];
  catalogoFestive: any[] = [];
  catalogoFestiveVigente: any[] = [];

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true,
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
    groupDefaultExpanded: -1,
    suppressAggFuncInHeader: true,
    onRowGroupOpened: (params) => {
      setTimeout(() => params.api.autoSizeAllColumns(), 50);
    },
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      if (!event.node.group) {
        event.node.setSelected(true);
      }
    },
    onRowSelected: (event) => {
      if (event.node.group) return;
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (!node.group && node.id !== event.node.id) {
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
        hide: true,
      },
      {
        field: 'idEmployee',
        headerName: 'ID Empleado',
        editable: true,
        hide: true,
      },
      {
        field: 'idBranch',
        headerName: 'ID Sucursal',
        editable: true,
        hide: true,
      },
      {
        field: 'date',
        headerName: 'Fecha',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'clock','MaeChe_Ajus', 'update');
        },
        cellEditor: 'agDateCellEditor',
        valueFormatter: (params) => {
          if (!params.value) return '';
          try {
            // Intentar parsear la fecha en diferentes formatos
            let date: Date;
            if (typeof params.value === 'string') {
              if (params.value.includes('T')) {
                date = new Date(params.value);
              } else {
                // Si es una fecha en formato YYYY-MM-DD
                const [year, month, day] = params.value.split('-').map(Number);
                date = new Date(year, month - 1, day);
              }
            } else {
              date = new Date(params.value);
            }

            if (isNaN(date.getTime())) {
              console.error('Fecha inválida:', params.value);
              return '';
            }

            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
          } catch (error) {
            console.error('Error al formatear fecha:', error);
            return '';
          }
        },
        valueParser: (params) => {
          if (!params.newValue) return null;
          try {
            const [day, month, year] = params.newValue.split('-').map(Number);
            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          } catch (error) {
            console.error('Error al parsear fecha:', error);
            return null;
          }
        },
        rowGroup: true,
      },
       {
        field: 'checkTime',
        headerName: 'Hora de Registro',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'clock','MaeChe_Ajus', 'update');
        },
        cellEditor: 'timeEditor',
        valueFormatter: (params) => {
          if (!params.value) return '';
          return params.value.split('.')[0];
        },
      },
      {
        field: 'realHourBySystem',
        headerName: 'Hora de Registro de Sistema',
        editable: false,
        cellEditor: 'timeEditor',
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
        valueFormatter: (params) => {
          if (!params.value) return '';
          return params.value.split('.')[0];
        },
      },
      {
        field: 'type',
        headerName: 'Tipo',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermissionDetail('hr', 'clock','MaeChe_Ajus', 'update');
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['IN', 'OUT'],
        }
      },

      {
        headerName: 'Horas Laboradas',
        field: 'hoursWorked',
        editable: false,
        cellRenderer: (params) => {
          if (params.node.group) {
            const groupData = params.node.allLeafChildren;
            let totalHours = 0;
            let totalDiscountHours = 0;
            let lastInTime = null;

            // DEBUG: Log para ver los datos de entrada
            const dateGroup = params.node.key;
            
            // Mostrar todos los registros sin filtrar

            // Filtrar y ordenar registros válidos
            const validRecords = [...groupData]
              .filter(node => {
                const record = node.data;
                // Incluir registros válidos O festivos que tengan hora
                const hasValidTime = record.realHourBySystem || record.checkTime;
                const isValidRecord = record.valid === true || record.holiday === true;
                const shouldInclude = hasValidTime && isValidRecord;
                
                return shouldInclude;
              })
              .sort((a, b) => {
                // Priorizar realHourBySystem sobre checkTime para el ordenamiento
                const timeA = a.data.realHourBySystem || a.data.checkTime;
                const timeB = b.data.realHourBySystem || b.data.checkTime;
                
                // Convertir a formato comparable si es necesario
                if (!timeA || !timeB) return 0;
                
                // Normalizar formato de tiempo (remover milisegundos si existen)
                const normalizeTime = (time) => time.split('.')[0];
                return normalizeTime(timeA).localeCompare(normalizeTime(timeB));
              });


            // Calcular horas trabajadas con lógica mejorada para pares IN/OUT
            const usedRecords = new Set();
            
            for (let i = 0; i < validRecords.length; i++) {
              const record = validRecords[i].data;
              
              // Skip si ya usamos este registro
              if (usedRecords.has(record.id)) continue;
              
              const hora = record.realHourBySystem || record.checkTime;
              if (!hora) continue;


              if (record.type === 'IN') {
                // Buscar el próximo OUT que no haya sido usado
                for (let j = i + 1; j < validRecords.length; j++) {
                  const outRecord = validRecords[j].data;
                  
                  if (usedRecords.has(outRecord.id)) continue;
                  
                  if (outRecord.type === 'OUT') {
                    const outHora = outRecord.realHourBySystem || outRecord.checkTime;
                    if (outHora) {
                      const hoursWorked = this.calculateTimeDifference(hora, outHora);
                      totalHours += hoursWorked;
                      
                      // Marcar ambos registros como usados
                      usedRecords.add(record.id);
                      usedRecords.add(outRecord.id);
                      break;
                    }
                  }
                }
                
                // Si no encontramos OUT para este IN
                if (!usedRecords.has(record.id)) {
                }
              } else if (record.type === 'OUT' && !usedRecords.has(record.id)) {
                // OUT sin IN previo - buscar hacia atrás
                for (let j = i - 1; j >= 0; j--) {
                  const inRecord = validRecords[j].data;
                  
                  if (usedRecords.has(inRecord.id)) continue;
                  
                  if (inRecord.type === 'IN') {
                    const inHora = inRecord.realHourBySystem || inRecord.checkTime;
                    if (inHora) {
                      const hoursWorked = this.calculateTimeDifference(inHora, hora);
                      totalHours += hoursWorked;
                      
                      // Marcar ambos registros como usados
                      usedRecords.add(record.id);
                      usedRecords.add(inRecord.id);
                      break;
                    }
                  }
                }
              }
            }

            // Calcular descuentos por minutos
            const discountMinutes = validRecords.reduce((sum, node) => {
              const record = node.data;
              if (
                record.minuteDiscount !== null &&
                record.minuteDiscount !== undefined &&
                !isNaN(record.minuteDiscount)
              ) {
                return sum + Number(record.minuteDiscount);
              }
              return sum;
            }, 0);

            totalDiscountHours = discountMinutes / 60;
            const netHours = Math.max(totalDiscountHours);


            return this.formatHours(totalHours);
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
        enableValue: false,
        cellRenderer: (params) => {
          if (params.node.group) {
            const groupData = params.node.allLeafChildren;

            // Solo INs en horario normal (09:00–21:00) generan salida pendiente
            const validInCount = [...groupData].filter(node => {
              const record = node.data;
              if (!record.valid || record.type !== 'IN') return false;
              const hour = record.checkTime ? parseInt(record.checkTime.split(':')[0], 10) : -1;
              return hour >= 9 && hour < 21;
            }).length;

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
        editable: (params) => {
          if (params.data.valid === true) return false;
          if (params.data.__isNew) return true;
          return this.authService.getCrudPermissionDetail('hr', 'clock','MaeChe_Ajus', 'update');
        },
        cellStyle: (params) => params.data?.valid === true ? { cursor: 'not-allowed' } : null,
      },
      {
        headerName: 'Faltas',
        field: 'absences',
        editable: false,
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
        headerName: 'Razón de motivo de falta',
        editable: (params) => {
          if (params.data.valid === true) return false;
          if (params.data.__isNew) return true;
          return this.authService.getCrudPermissionDetail('hr', 'clock','MaeChe_Ajus', 'update');
        },
        cellStyle: (params) => params.data?.valid === true ? { cursor: 'not-allowed' } : null,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.catalogoAusencias.map(item => item.id.toString()),
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const ausencia = this.catalogoAll.find(item => item.id.toString() === params.value.toString());
          return ausencia ? ausencia.description : '';
        },
        valueParser: (params) => {
          return params.newValue;
        }
      },
      {
        field: 'minuteDiscount',
        headerName: 'Minutos Descontados',
        editable: false,
        cellDataType: 'number',
        cellEditor: 'agTextCellEditor',
      },
      {
        field: 'minuteDiscountBackup',
        headerName: 'Minutos Descontados Respaldo',
        editable: false,
        cellDataType: 'number',
        cellEditor: 'agTextCellEditor',
      },
      {
        field: 'edited',
        headerName: 'Editado',
        editable: false,
      },
      {
        field: 'byTimeClock',
        headerName: 'Checador?',
        editable: false,
      },
      {
        field: 'editedBy',
        headerName: 'Editado por',
        editable: false,
      },
    ];
  }
  obtenerCatalogo(idCompany: number) {
    this.clockService.getCatalogs(idCompany).subscribe((data: any) => {
      this.catalogoAll = data;
    });
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

  obtenerCatalogoFestivo(idCompany: number) {
    this.clockService.getCatalogsFestive(idCompany).subscribe((data: any) => {
      this.catalogoFestive = data;
    });
  }

  obtenerCatalogoFestivoVigente(idCompany: number) {
    this.clockService.getCatalogsFestiveVigente(idCompany).subscribe((data: any) => {
      this.catalogoFestiveVigente = data;
    });
  }

  obtenerDatos(idEmployee: number, fechaInicio: string, fechaFin: string) {
    this.clockService
      .checkInOutByEmployee(idEmployee, fechaInicio, fechaFin)
      .subscribe((data: any) => {
        // Asegurarse de que las fechas estén en el formato correcto
        this.rowData = data.map((item: any) => ({
          ...item,
          date: item.date ? new Date(item.date).toISOString().split('T')[0] : null
        }));
        this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Detalle de Checador', 'Menu Recursos Humanos Detalle de Checador',  this.trackingService.getEmail());
        setTimeout(() => this.gridApi?.autoSizeAllColumns(), 50);
      });
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Add Registro en Detalle de Checador', 'Menu Recursos Humanos Detalle de Checador', this.trackingService.getEmail());
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
    newRows.forEach((row, index) => {
      const cleanedData = this.cleanDataForServer(row);
    });

    // Mostrar los datos de las filas modificadas que se van a enviar
    modifiedRows.forEach((row, index) => {
      const cleanedData = this.cleanDataForServer(row);
    });

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Add Registro en Detalle de Checador', 'Menu Recursos Humanos Detalle de Checador', this.trackingService.getEmail());
      return this.clockService.checkInOut(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Update Registro en Detalle de Checador', 'Menu Recursos Humanos Detalle de Checador', this.trackingService.getEmail());
      return this.clockService.updateCheckInOut(row.id, cleanedData);
    });
    this.signalsService.triggerRefreshEmployees();
    //alert(this.signalsService.getRefreshEmployees()() )
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
      this.signalsService.setRefreshClock(true);
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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Revertir Registro en Detalle de Checador', 'Menu Recursos Humanos Detalle de Checador', this.trackingService.getEmail());
  }

private cleanDataForServer(data: any): any {
  const cleanedData = { ...data };

  // Eliminar campos basura
  delete cleanedData.employeeName;
  delete cleanedData.__isNew;
  delete cleanedData.__modified;
  delete cleanedData.idBranch;

  if (cleanedData.id?.toString().startsWith('temp_')) {
    delete cleanedData.id;
  }

  // Preparar la fecha como YYYY-MM-DD
  const dateStr = cleanedData.date
    ? (typeof cleanedData.date === 'string'
        ? cleanedData.date
        : new Date(cleanedData.date).toISOString()
      ).split('T')[0]
    : null;

  // Generar timeStamp y adjustedTimeBySystem si hay checkTime
  if (dateStr && cleanedData.checkTime) {
    const formattedCheckTime = cleanedData.checkTime.includes('.')
      ? cleanedData.checkTime.split('.')[0]
      : cleanedData.checkTime;

    cleanedData.timeStamp = `${dateStr}T${formattedCheckTime}`;
    cleanedData.adjustedTimeBySystem = `${dateStr}T${formattedCheckTime}`;
  }

  // Si hay modifiedCheckTime, se sobrescribe adjustedTimeBySystem
  if (dateStr && cleanedData.modifiedCheckTime) {
    const formattedModified = cleanedData.modifiedCheckTime.includes('.')
      ? cleanedData.modifiedCheckTime.split('.')[0]
      : cleanedData.modifiedCheckTime;

    cleanedData.timeStampBackup = `${dateStr}T${formattedModified}`;
    cleanedData.adjustedTimeBySystem = `${dateStr}T${cleanedData.checkTime}`;
    cleanedData.realHourBySystem = null;
  }

  // Limpiar campos originales
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

    let hours = Math.floor(totalHours);
    let minutes = Math.round((totalHours - hours) * 60);

    // Corrección para que no aparezcan 60 minutos en la vista
    if (minutes == 60) {
      minutes = 0;
      hours = hours + 1;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Método para obtener el día de la semana en español
  private diasSemana = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
  ];

  // Este sí retorna el nombre del día, lo puedes usar si lo necesitas aparte
  private obtenerNombreDiaSemana(fecha: string): string {
    const [year, month, day] = fecha.split('-').map(Number);
    const fechaObj = new Date(year, month - 1, day);
    return this.diasSemana[fechaObj.getDay()];
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
    if (this.justificanteForm.value.controlInicio !== '' && this.justificanteForm.value.justificante !== '') {
      const formValues = { ...this.justificanteForm.value };
      const fechaInicio = new Date(formValues.controlInicio + 'T00:00:00');
      const fechaFin = formValues.controlFin
        ? new Date(formValues.controlFin + 'T00:00:00')
        : new Date(fechaInicio); // Si no hay fecha fin, solo se procesa un día

      const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const nuevasFilas = [];

      alerts.confirmAlert(
        'Confirmar',
        '¿Está seguro que desea añadir estos datos al sistema?',
        'warning',
        'Sí, añadir'
      ).then((result) => {
        if (!result.isConfirmed) return;

        const procesarDia = (current: Date) => {
          if (current > fechaFin) {
            // Ya terminó el recorrido, ahora sí aplica al grid
            this.rowData = [...nuevasFilas, ...this.rowData];
            this.gridApi.setGridOption('rowData', this.rowData);
            this.notSavedChanges = true;

            // Cerrar el modal
            const modalElement = document.getElementById('addJustificanteModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();

            // Resetear formulario
            this.justificanteForm.reset({
              controlInicio: this.getLocalDate(),
              controlFin: '',
              justificante: ''
            });

            return;
          }

          const nombreDia = diasSemana[current.getDay()];
          const fechaStr = current.toISOString().split('T')[0];
          const idReason = formValues.justificante;

          this.employeesService.getEmployeeClockByDay(this.idEmployee, nombreDia).subscribe({
            next: (data: any) => {
              const employee = data[0];

              if (!employee) {
                alerts.basicAlert(
                  'Error',
                  `No se encontró información del horario para el día ${nombreDia}`,
                  'error'
                );
                // Continuar con el siguiente día
                current.setDate(current.getDate() + 1);
                procesarDia(current);
                return;
              }

              if (!employee.enabled) {
                if (this.justificanteForm.value.controlFin == '') {
                  alerts.basicAlert(
                    'Error',
                    `El empleado no labora el día ${nombreDia}`,
                    'error'
                  );
                }
                // Continuar con el siguiente día
                current.setDate(current.getDate() + 1);
                procesarDia(current);
                return;
              }

              // Función auxiliar para crear filas
              const crearFila = (checkTime: string, type: 'IN' | 'OUT') => ({
                id: `temp_${this.tempIdCounter++}`,
                idEmployee: this.idEmployee,
                idBranch: this.idBranch,
                date: fechaStr,
                checkTime: checkTime,
                modifiedCheckTime: '',
                holiday: true,
                type: type,
                valid: false,
                minuteDiscount: 0,
                minuteDiscountBackup: null,
                edited: true,
                byTimeClock: false,
                idReason: Number(idReason),
                editedBy: this.signalsService.getDisplayName()(),
                active: true,
                __isNew: true
              });

              nuevasFilas.push(crearFila(employee.entry1, 'IN'));
              const newHora = this.sumarHoras(employee.entry1, employee.hours);
              nuevasFilas.push(crearFila(newHora, 'OUT'));

              // Continuar con el siguiente día
              current.setDate(current.getDate() + 1);
              procesarDia(current);
              this.signalsService.setRefreshClock(true);
            },
            error: (err) => {
              console.error(`Error al obtener datos del empleado para ${nombreDia}`, err);
              alerts.basicAlert(
                'Error',
                `Error al obtener datos del empleado para ${nombreDia}`,
                'error'
              );
              // Continuar con el siguiente día aunque falle
              current.setDate(current.getDate() + 1);
              procesarDia(current);
            }
          });
        };

        // Iniciar recorrido
        procesarDia(new Date(fechaInicio));
      });
    } else {
      alerts.basicAlert('Error', 'Por favor complete todos los campos requeridos', 'error');
    }
  }
  cancelar() {
    this.justificanteForm.reset({
      controlInicio: this.getLocalDate(),
      controlFin: '',
      justificante: ''
    });
  }


  sumarHoras(horaStr: string, horasASumar: number): string {
    const [h, m, s] = horaStr.split(':').map(Number);

    // Convertir hora base a minutos totales
    let totalMinutos = h * 60 + m;

    // Convertir horas decimales a minutos
    const minutosASumar = Math.round(horasASumar * 60);

    totalMinutos += minutosASumar;

    // Calcular nueva hora
    const nuevaHora = Math.floor(totalMinutos / 60) % 24;
    const nuevosMinutos = totalMinutos % 60;

    // Convertir a string con formato HH:mm:ss
    const horaFormateada = `${String(nuevaHora).padStart(2, '0')}:${String(nuevosMinutos).padStart(2, '0')}:00`;

    return horaFormateada;
  }
}
