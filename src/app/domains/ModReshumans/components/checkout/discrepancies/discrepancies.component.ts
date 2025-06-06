import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from '../../../../../helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { PayrollService } from 'app/services/payroll.service';
import { ClockService } from 'app/services/clock.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { concat, toArray } from 'rxjs';

@Component({
  selector: 'app-discrepancies',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule],
  templateUrl: './discrepancies.component.html',
  styleUrl: './discrepancies.component.scss'
})
export default class DiscrepanciesComponent implements OnInit {
  //  private administrationService = inject(AdministrationService);
  private payrollService = inject(PayrollService);
  private signalsService = inject(SignalsService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private clockService = inject(ClockService);

  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.obtenerDatos();
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerCatalogoDiscrepancias(this.idCompany);
  }

  constructor() {
    effect(async () => {
      if (this.signalsService.getRefreshEmployees()() == true) {
        await this.obtenerDatos(); // Actualizar datos cuando se recibe señal
        this.signalsService.resetRefreshEmployees(); // Resetear la señal después de actualizar
      }
    });

    this.selectFechas = this.fb.group({
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required]
    });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerDatos();
    });

    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerCatalogoDiscrepancias(this.idCompany);
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  selectFechas: FormGroup;
  type: string = ''; // Para almacenar el tipo (CUSTOMERS o PROVIDERS)
  gridHeight: string = '75vh';
  showDetailsTab: boolean = false;
  showSpecialTimesTab: boolean = false;
  private gridApi: GridApi;
  notSavedChanges: boolean = false;
  selectedRowData: any = null;
  isOpen: boolean = false;
  branchs: any[] = [];
  Typecop: any[] = [];
  idCompany: number;

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;

  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];

  id: number;
  idBranch: number = 8;
  selectedTab: string = 'customers-payments';
  idEmployee: number;
  fechaInicio: any;
  fechaFin: any;
  catalogoDiscrepancias: any[] = [];


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


  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    groupDefaultExpanded: -1, // -1 significa expandir todos los grupos
    rowClassRules: {
      'discrepancy-row': (params) => params.data && !params.data.hasOwnProperty('allowDiscrepance'),
      'selected-row': (params) => params.node.isSelected()
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
    }
  };



  get colMaster(): ColDef[] {
    return [
      {
        field: 'id',
        headerName: 'ID',
        editable: false,
        width: 80,
        hide: true
      },
      {
        field: 'idEmployee',
        headerName: 'ID Empleado',
        editable: false,
        width: 100,
        hide: true
      },
      {
        field: 'name',
        headerName: 'Nombre',
        editable: false,
        width: 200
      },
      {
        field: 'idBranch',
        headerName: 'ID Sucursal',
        editable: false,
        width: 100,
        hide: true
      },
      {
        field: 'dateStamp',
        headerName: 'Fecha',
        editable: false,
        width: 120,
        valueGetter: (params) => {
          if (!params.data?.dateStamp) return '';
          return params.data.dateStamp;
        }
      },
      {
        field: 'timeStampOnly',
        headerName: 'Hora Registro',
        editable: false,
        width: 120
      },
      {
        field: 'realTimeOnly',
        headerName: 'Hora Real',
        editable: false,
        width: 120
      },
      {
        field: 'timeDiscrepance',
        headerName: 'Diferencia (min)',
        editable: false,
        width: 120
      },
      {
        field: 'allowDiscrepance',
        headerName: 'Permitir Diferencia',
        editable: false,
        hide: true
      },
      {
        field: 'discrepanceAllowedReason',
        headerName: 'Razón de discrepancia',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.catalogoDiscrepancias.map(item => item.id.toString()),
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const discrepancia = this.catalogoDiscrepancias.find(item => item.id.toString() === params.value.toString());
          return discrepancia ? discrepancia.description : '';
        },
        valueParser: (params) => {
          return params.newValue;
        },
        onCellValueChanged: (params) => {
          if (params.newValue) {
            const discrepancia = this.catalogoDiscrepancias.find(item => item.id.toString() === params.newValue.toString());
            if (discrepancia) {
              params.data.allowDiscrepance = discrepancia.valueAdditionBit;
              params.api.refreshCells({ force: true });
            }
          }
        }
      },
      {
        field: 'discrepanceAllowedApprovedBy',
        headerName: 'Modificado por',
        editable: false,
        width: 150
      },
      {
        field: 'type',
        headerName: 'Tipo',
        editable: false,
        width: 100
      }
    ];
  }

  obtenerDatos(fechaInicio: string = '', fechaFin: string = '') {
    this.clockService.getHourDiscrepancies(this.idBranch, fechaInicio, fechaFin).subscribe((data: any) => {
      this.rowData = [];
      this.rowData = data;
      console.log(this.rowData);
      // Esperar a que el grid se actualice y luego ajustar las columnas
      setTimeout(() => {
        if (this.gridApi) {
          this.gridApi.redrawRows();
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
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
    this.lastEditedRowId = event.data.id; // Guardar el ID de la última fila editada
    event.data.discrepanceAllowedApprovedBy = this.signalsService.getDisplayName()();
  }


  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
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


  Consultar() {
    if (this.selectFechas.valid) {
      const datos = this.selectFechas.value;
      this.fechaInicio = datos.fechaInicio;
      this.fechaFin = datos.fechaFin;
      console.log(this.fechaInicio, this.fechaFin)
      this.obtenerDatos(this.fechaInicio, this.fechaFin);
    } else {
      alerts.basicAlert('Error', 'Por favor selecciona ambas fechas', 'error');
    }
  }

  obtenerCatalogoDiscrepancias(idCompany: number) {
    this.clockService.getCatalogsDiscrepancies(idCompany).subscribe((data: any) => {
      this.catalogoDiscrepancias = data;
      console.log(this.catalogoDiscrepancias);
    });
  }

  saveChanges() {
    // Filtrar solo las filas modificadas
    const modifiedRows = this.rowData.filter(row => row.__modified);
    console.log(modifiedRows);

    if (modifiedRows.length === 0) {
      alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
      return;
    }

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.clockService.updateCheckInOutForDiscrepancies(row.id, cleanedData);
    });

    // Ejecutar todas las suscripciones
    concat(...updateObservables).pipe(toArray()).subscribe({
      next: () => {
        alerts.basicAlert('Éxito', 'Cambios guardados correctamente', 'success');
        this.obtenerDatos();
        this.notSavedChanges = false;
      },
      error: (error) => {
        alerts.basicAlert('Error', 'Error al guardar los cambios', 'error');
        console.error('Error al guardar:', error);
      }
    });
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__modified;
    delete cleanedData.idEmployee;
    delete cleanedData.name;
    delete cleanedData.idBranch;
    delete cleanedData.dateStamp;
    delete cleanedData.timeStampOnly;
    delete cleanedData.realTimeOnly;
    delete cleanedData.timeDiscrepance;
    return cleanedData;
  }
}
