import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { IssuesService } from 'app/services/issues.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { IssuesInfoComponent } from '../issues-info/issues-info.component';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, IssuesInfoComponent],
  templateUrl: '../identification/identification.component.html',
  styleUrl: './analysis.component.scss'
})
export class AnalysisComponent {
  private issuesService = inject(IssuesService);
  private signalsService = inject(SignalsService);
  idIdentification = this.signalsService.idIdentification;
  idIdentif: number;
  nameIdentif: string;

  constructor() {
    effect(() => {
      this.idIdentif = this.signalsService.idIdentification();
      this.nameIdentif = this.signalsService.nameIdentification();
      this.obtenerDatos();
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

  obtenerDatos() {
    this.issuesService
      .getAnalysis(this.idIdentif)
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


  get columnDefs(): ColDef[] {
    return [
      {
        field: 'dateStart',
        headerName: 'Fecha de inicio',
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
        field: 'dateEnd',
        headerName: 'Fecha de fin',
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
        field: 'routeCritica',
        headerName: 'Ruta Crítica',
        editable: true,
        flex: 1,
      },
      {
        field: 'severity',
        headerName: 'Severidad',
        editable: true,
        flex: 1,
      },
      {
        field: 'phase',
        headerName: 'Fase',
        editable: true,
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
  setSignals() {
    this.signalsService.setIdAnalysis(this.selectedRowData.id);
    this.signalsService.setAnalysisName(this.selectedRowData.event);
    //Borramos las demas signals
    this.signalsService.setContingencyActionName(null);
    this.signalsService.setIdContingencyAction(null);
  }

  onCellValueChanged(event: any) {
    this.setSignals();
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
      idIdenfitication: this.idIdentif,
      idwp: 2,
      dateStart: null,
      dateEnd: null,
      routeCritica: "No",
      severity: 1,
      phase: "Construccion",
      active: 1
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.issuesService.addAnalysis(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.issuesService.updateAnalysis(row.id, cleanedData);
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
    this.issuesService.deleteAnalysis(id).pipe(
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
          this.resetSignals();
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
  resetSignals() {
    this.signalsService.setAnalysisName(null);
    this.signalsService.setIdAnalysis(null);
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
