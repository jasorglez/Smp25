import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { GridApi, ColDef, GridReadyEvent, CellDoubleClickedEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { catchError, of, lastValueFrom, concat, toArray, EMPTY } from 'rxjs';
import { RiskmatrixService } from 'app/services/riskmatrix.service';
import { MultiLineEditorComponent } from "../../../../../shared/multi-line/multi-line-editor.component";
import { ModalService } from 'app/services/modal.service';
import { RisksInfoComponent } from "./risks-info.component";

@Component({
  selector: 'app-planification-risk',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, RisksInfoComponent, MultiLineEditorComponent, RisksInfoComponent],
  templateUrl: './planification-risk.component.html'
})
export class PlanificationRiskComponent {


  private riskMatrixService = inject(RiskmatrixService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);

  idProject: number = null;
  idAnalysisRisk = this.signalsService.getIdAnalysisRisk()();
  fecha: any;

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
  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent,
  };

  obtenerDatos() {
    this.riskMatrixService
      .getPlanificationRisks(this.idAnalysisRisk)
      .pipe(
        catchError((error) => {
          console.error('Error al obtener identificaciones:', error);
          return of([]); // Retorna un Observable que emite un array vacío en caso de error
        })
      )
      .subscribe({
        next: (data: any) => {
          this.rowData = data;
          console.log(this.rowData);
        },
        error: () => {
          this.rowData = []; // Asigna un array vacío en caso de error
        }
      });
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'actions',
        headerName: 'Acciones',
        editable: true,
        width: 160
      },
      {
        field: 'startDate',
        headerName: 'Fecha de inicio',
        editable: true,
        width: 100
      },
      {
        field: 'endDate',
        headerName: 'Fecha de fin',
        editable: true,
        width: 100
      },
      {
        field: 'resources',
        headerName: 'Recursos',
        editable: true,
        width: 80
      },
      {
        field: 'time',
        headerName: 'Tiempo',
        editable: true,
        width: 80
      },
      {
        field: 'cost',
        headerName: 'Costo',
        editable: true,
        width: 80
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
    //this.signalsService.setIdPlanificationRisk(this.selectedRowData.id);
    // this.signalsService.setNameIdentificationRisk(this.selectedRowData.description);
    // this.signalsService.setCauseIdentificationRisk(this.selectedRowData.cause);
    // // Borramos las demas signals
    // this.signalsService.setIdAnalysis(null);
    // this.signalsService.setAnalysisName(null);
    // this.signalsService.setContingencyActionName(null);
    // this.signalsService.setIdContingencyAction(null); 
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idAnalysis: this.idAnalysisRisk,
      actions: "",
      startDate: "",
      endDate: "",
      resources: "",
      cost: "",
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
      console.log(cleanedData);
      return this.riskMatrixService.addPlanificationRisk(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      return this.riskMatrixService.updatePlanificationRisk(row.id, cleanedData);
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
    this.riskMatrixService.deletePlanificationRisk(id).pipe(
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
    if (cleanedData.id && (typeof cleanedData.id === 'string' && cleanedData.id.startsWith('temp_') || cleanedData.__isNew)) {
      delete cleanedData.id;
    }

    return cleanedData;
  }

}
