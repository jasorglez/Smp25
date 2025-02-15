import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { IssuesService } from 'app/services/issues.service';
import { catchError, concat, EMPTY, lastValueFrom, of, toArray } from 'rxjs';
import { IssuesInfoComponent } from "../issues-info/issues-info.component";
import { MultiLineEditorComponent } from "../../../../../../shared/multi-line/multi-line-editor.component";

@Component({
  selector: 'app-identification',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, IssuesInfoComponent, MultiLineEditorComponent],
  templateUrl: './identification.component.html',
  styleUrl: './identification.component.scss'
})
export class IdentificationComponent {

  private issuesService = inject(IssuesService);
  private signalsService = inject(SignalsService);
  idProject: number = null;
  idIdentification = this.signalsService.idIdentification;

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

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  rowData: any;
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  frameworkComponents: { [p: string]: any; };

  obtenerDatos() {
    this.issuesService
      .getIdentifications(this.idProject)
      .pipe(
        catchError((error) => {
          console.error('Error al obtener identificaciones:', error);
          return of([]); // Retorna un Observable que emite un array vacío en caso de error
        })
      )
      .subscribe({
        next: (data: any) => {
          this.rowData = data;
        },
        error: () => {
          this.rowData = []; // Asigna un array vacío en caso de error
        }
      });
  }

  gridOptions = {
    headerHeight: 30,
    rowHeight: 30
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'event',
        headerName: 'Evento',
        editable: true,
        flex: 1
      },
      {
        field: 'clasification',
        headerName: 'Clasificación',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: ['Administrativo', 'Técnico'],
        },
        flex: 2,
      },
      {
        field: 'dateRegistry',
        headerName: 'Fecha de registro',
        editable: true,
        flex: 2,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        flex: 3,
      },
      {
        field: 'cause',
        headerName: 'Causa',
        editable: true,
        flex: 3,
      },
      {
        field: 'administrator',
        headerName: 'Administrador',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: ['Pemex', 'Contratista'],
        },
        flex: 2,
      },
    ];
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.setSignals();
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    this.setSignals();
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  setSignals() {
    this.signalsService.setIdIdentification(this.selectedRowData.id);
    this.signalsService.setIdProjectByIdentification(this.selectedRowData.idProject);
    this.signalsService.setIdentificationName(this.selectedRowData.description);
    this.signalsService.setClassificationIdentification(this.selectedRowData.clasification);
    this.signalsService.setEventIdentification(this.selectedRowData.event);
    this.signalsService.setRegisteredDateIdentification(this.selectedRowData.dateRegistry);
    // Borramos las demas signals
    this.signalsService.setIdAnalysis(null);
    this.signalsService.setAnalysisName(null);
    this.signalsService.setContingencyActionName(null);
    this.signalsService.setIdContingencyAction(null);
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idProject: this.idProject,
      event: "",
      classification: "",
      dateRegistry: "",
      cause: "",
      administrator: "",
      active: 1
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
      return this.issuesService.addIdentification(cleanedData);
    });
  
    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.issuesService.updateIdentification(row.id, cleanedData);
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
    this.issuesService.deleteIdentification(id).pipe(
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
          this.signalsService.setIdIdentification(null);
          this.signalsService.setIdentificationName(null);
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
    if (cleanedData.id && (typeof cleanedData.id === 'string' && cleanedData.id.startsWith('temp_') || cleanedData.__isNew)) {
      delete cleanedData.id;
    }

    return cleanedData;
  }

}
