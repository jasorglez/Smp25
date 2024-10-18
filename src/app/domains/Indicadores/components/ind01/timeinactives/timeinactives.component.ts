import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { TimeinactivesService } from 'app/services/timeinactives.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { MultiLineEditorComponent } from '../issues/multi-line-editor.component';
import { ModalService } from 'app/services/modal.service';
import { TimeEditorComponent } from './time-editor.component';

interface WorkProgram {
  id: number;
  activity: string;
  text: string;
}

interface Catalog {
  id: number;
  description: string;
}

@Component({
  selector: 'app-timeinactives',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent, TimeEditorComponent],
  templateUrl: './timeinactives.component.html',
  styleUrl: './timeinactives.component.scss'
})
export class TimeinactivesComponent {
  private timeinactivesService = inject(TimeinactivesService);
  private workprogramsService = inject(WorkprogramsService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);
  private idProject = this.signalsService.getProjectSelectedBySidebar()();

  constructor() {
    effect(() => {
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      if (this.idProject == null) {
        this.rowData = [];
        alerts.basicAlert('Tiempos inactivos', 'Debe elegir un proyecto primero.', 'error');
      }
      else {
        this.obtenerDatos();
        this.fetchWorkPrograms();
        this.fetchAreas();
        this.fetchCauses();
      }
    });
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
  companys: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  workProgramData: WorkProgram[] = [];
  areaData: Catalog[] = [];
  causeData: Catalog[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent,
    timeEditor: TimeEditorComponent
  };

  obtenerDatos() {
    this.timeinactivesService
      .getInactiveTimes(Number(this.idProject))
      .subscribe(
        (data: any) => {
          this.rowData = data;
        },
        (error) => {
          if (error.status === 404) {
            console.error('Data not found (404 error).');
            // Handle the 404 error as needed, e.g., display a message to the user.
          } else {
            console.error('An error occurred:', error);
          }
          this.rowData = [];
        }
      );
  }

  fetchWorkPrograms() {
    this.workprogramsService.getWorkPrograms2Fields(this.idProject).subscribe(
      (data: WorkProgram[]) => {
        this.workProgramData = data;
        console.log(this.workProgramData);
      },
      (error) => console.error('Error fetching work programs:', error)
    );
  }

  fetchAreas() {
    this.timeinactivesService.getArea().subscribe(
      (data: Catalog[]) => {
        this.areaData = data;
        console.log(this.areaData)
      },
      (error) => console.error('Error fetching areas:', error)
    );
  }

  fetchCauses() {
    this.timeinactivesService.getCause().subscribe(
      (data: Catalog[]) => {
        this.causeData = data;
      },
      (error) => console.error('Error fetching causes:', error)
    );
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'date',
        headerName: 'Fecha',
        editable: true,
        width: 150,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'idArea',
        headerName: 'Área',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.areaData.map(item => item.id),
        },
        valueFormatter: (params) => {
          const foundItem = this.areaData.find(item => item.id === params.value);
          return foundItem ? `${foundItem.description}` : params.value;
        }
      },
      {
        field: 'idClasification',
        headerName: 'Clasificación',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.causeData.map(item => item.id),
        },
        valueFormatter: (params) => {
          const foundItem = this.causeData.find(item => item.id === params.value);
          return foundItem ? `${foundItem.description}` : params.value;
        }
      },
      {
        field: 'timeStart',
        headerName: 'Hora de inicio',
        editable: true,
        width: 150,
        cellEditor: 'timeEditor',
        valueFormatter: (params) => {
          if (params.value) {
            return this.formatTime(params.value);
          }
          return '';
        },
        valueParser: (params) => {
          return this.parseTime(params.newValue);
        }
      },
      {
        field: 'timeEnd',
        headerName: 'Hora de fin',
        editable: true,
        width: 150,
        cellEditor: 'timeEditor',
        valueFormatter: (params) => {
          if (params.value) {
            return this.formatTime(params.value);
          }
          return '';
        },
        valueParser: (params) => {
          return this.parseTime(params.newValue);
        }
      },
      {
        field: 'total',
        headerName: 'Total Afectación',
        editable: false,
        width: 150,
      },
      {
        field: 'idProgram',
        headerName: 'Tarea',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.workProgramData.map(item => item.id),
        },
        valueFormatter: (params) => {
          const foundItem = this.workProgramData.find(item => item.id === params.value);
          return foundItem ? `${foundItem.activity} - ${foundItem.text}` : params.value;
        }
      },
      {
        field: 'cause',
        headerName: 'Causas',
        editable: true,
        width: 300,
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
      idProject: this.idProject,
      idArea: null,
      idClasification: null,
      date: '',
      timeStart: '',
      timeEnd: '',
      idProgram: null,
      cause: '',
      active: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const newRows = this.rowData.filter((row) => this.newlyAddedRows.includes(row.id));
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !this.newlyAddedRows.includes(row.id)
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.timeinactivesService.addInactiveTime(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.timeinactivesService.updateInactiveTime(row.id, cleanedData);
    });

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
    this.timeinactivesService.deleteInactiveTime(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Error al eliminar la entrada.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    )
      .subscribe(
        () => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.obtenerDatos();

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.notSavedChanges = false;
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.total;
    if (cleanedData.id && (typeof cleanedData.id === 'string' && cleanedData.id.startsWith('temp_') || cleanedData.__isNew)) {
      delete cleanedData.id;
    }

    return cleanedData;
  }

  // Para el formato de hora
  private formatTime(time: string): string {
    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
      return time; // Ya está en el formato correcto
    }
    return '';
  }

  private parseTime(value: string): string {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (timeRegex.test(value)) {
      return `${value}:00`; // Añade los segundos si no están presentes
    }
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
      return value; // Ya está en el formato correcto
    }
    return '00:00:00';
  }

}
