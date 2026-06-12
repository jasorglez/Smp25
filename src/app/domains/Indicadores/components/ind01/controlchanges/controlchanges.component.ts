import { Component, effect, HostListener, inject } from '@angular/core';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { catchError, concat, lastValueFrom, of, toArray } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';
import { ControlChangesService } from 'app/services/control-changes.service';
import { MultiLineEditorComponent } from "../../../../../shared/multi-line/multi-line-editor.component";
import { ModalService } from 'app/services/modal.service';

@Component({
  selector: 'app-check-cell',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `<img [src]="params.value" width="30" height="30" alt="Elija calificación">`
})
export class CheckCellRendererComponent implements ICellRendererAngularComp {
  params: any;

  agInit(params: any): void {
    this.params = params;
  }

  refresh(params: any): boolean {
    this.params = params;
    return true;
  }
}

@Component({
  selector: 'app-controlchanges',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './controlchanges.component.html',
  styleUrl: './controlchanges.component.scss',
  providers: [DatePipe]
})
export class ControlChangesComponent {

  private idProject = 0;
  fecha: string;

  private signalsService = inject(SignalsService);
  private datePipe = inject(DatePipe);
  private controlChangesService = inject(ControlChangesService);
  private modalServiceTable = inject(ModalService);

  constructor() {
    effect(() => {
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      if (this.idProject == null) {
        this.rowData = [];
        alerts.basicAlert('Issues', 'Debe elegir un proyecto primero.', 'error');
      }
      else {
        this.obtenerDatos();
      }
    });
  }

  ngOnInit(): void {
    // Formatear la fecha actual al formato yyyy-MM-dd
    this.fecha = this.datePipe.transform(new Date(), 'yyyy-MM-dd');

  }

  onFechaChange() {
    this.obtenerDatos();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  obtenerDatos() {
    this.controlChangesService.getControlChanges(this.idProject, this.fecha).pipe(
      catchError((error) => {
        console.error('Error al obtener identificaciones:', error);
        this.rowData = [];
        return of([]);
      })
    )
      .subscribe({
        next: (data: any) => {
          this.rowData = data;
        },
        error: () => {
          this.rowData = [];
        }
      });
  }


  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true
  };

  gridOptions = {
    headerHeight: 30,
    rowHeight: 30
  }

  starOptions = [
    {
      value: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2fx.png?alt=media&token=97734738-8a60-4e23-afc1-5af74e70d2cd',
      label: 'Tache'
    },
    {
      value: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2fpaloma.png?alt=media&token=64a0415d-0406-4635-bea5-1071bf72d399',
      label: 'Paloma'
    }
  ];

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'concept',
        headerName: 'Concepto',
        editable: false,
        width: 200,
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
        field: 'scope',
        headerName: 'Alcance',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.starOptions.map(option => option.value),
          cellRenderer: CheckCellRendererComponent,
          cellClass: 'custom-select-cell' // Añadimos esta clase personalizada
        },
        cellRenderer: CheckCellRendererComponent,
        width: 120
      },
      {
        field: 'time',
        headerName: 'Tiempo',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.starOptions.map(option => option.value),
          cellRenderer: CheckCellRendererComponent,
          cellClass: 'custom-select-cell' // Añadimos esta clase personalizada
        },
        cellRenderer: CheckCellRendererComponent,
        width: 120
      },
      {
        field: 'cost',
        headerName: 'Costo',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.starOptions.map(option => option.value),
          cellRenderer: CheckCellRendererComponent,
          cellClass: 'custom-select-cell' // Añadimos esta clase personalizada
        },
        cellRenderer: CheckCellRendererComponent,
        width: 120
      },
      {
        field: 'coordinate',
        headerName: 'Coordinador',
        editable: true,
        width: 150
      },
      {
        field: 'resident',
        headerName: 'Residente',
        editable: true,
        width: 150
      },
      {
        field: 'supervisor',
        headerName: 'Supervisor',
        editable: true,
        width: 150
      },
      {
        field: 'startDate',
        headerName: 'Fecha inicio',
        editable: true,
        width: 120,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'endDate',
        headerName: 'Fecha fin',
        editable: true,
        width: 120,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'amount',
        headerName: 'Monto',
        editable: true,
        width: 100,
        cellDataType: 'number',
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
        }
      },
      {
        field: 'observation',
        headerName: 'Observaciones',
        editable: false,
        width: 200,
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
        field: 'authorizeUser',
        headerName: 'Autorizado por',
        editable: false,
        width: 200
      }
    ];
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
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      date: this.fecha,
      idProject: this.idProject,
      scope: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2fx.png?alt=media&token=97734738-8a60-4e23-afc1-5af74e70d2cd',
      time: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2fx.png?alt=media&token=97734738-8a60-4e23-afc1-5af74e70d2cd',
      cost: 'https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2fx.png?alt=media&token=97734738-8a60-4e23-afc1-5af74e70d2cd',
      startDate: '',
      endDate: '',
      amount: '',
      observation: '',
      authorizeUser: localStorage.getItem('mail'),
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);

    // Encontrar la primera columna editable
    const firstEditableCol = this.columnDefs.find(col => col.editable);
    const firstEditableColKey = firstEditableCol ? firstEditableCol.field : null;

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

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.idProject);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar los campos antes de guardar.',
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

      return this.controlChangesService.addControlChange(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.controlChangesService.updateControlChange(row.id, cleanedData);
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
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
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
