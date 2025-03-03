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
import { WorkprogramsService } from 'app/services/workprograms.service';

interface WorkProgram {
  id: number;
  activity: string;
  text: string;
  startDate: string;
  endDate: string;
  criticRoute: string;
  phase: string;
}

@Component({
  selector: 'app-analysis-risk',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, RisksInfoComponent, MultiLineEditorComponent, RisksInfoComponent],
  templateUrl: './sub-template-risk.component.html'
})
export class AnalysisRiskComponent {

  private riskMatrixService = inject(RiskmatrixService);
  private workprogramsService = inject(WorkprogramsService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);

  idProject: number = null;
  idIdentificationRisk = this.signalsService.getIdIdentificationRisk()();
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
        this.fetchWorkPrograms();
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
  workProgramData: WorkProgram[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent,
  };

  obtenerDatos() {
    this.riskMatrixService
      .getAnalysisRisks(this.idIdentificationRisk)
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

  fetchWorkPrograms() {
    this.workprogramsService.getWorkPrograms2Fields(this.idProject).subscribe(
      (data: WorkProgram[]) => {
        this.workProgramData = data;
        this.updateActivityOptions();
        console.log(this.idProject);
      },
      (error) => console.error('Error fetching work programs:', error)
    );
  }

  updateActivityOptions() {
    const idwpColDef = this.columnDefs.find(col => col.field === 'idProgram');
    if (idwpColDef && idwpColDef.cellEditorParams) {
      idwpColDef.cellEditorParams.values = this.workProgramData.map(item => ({
        value: item.id,
        label: `${item.activity} - ${item.text}`
      }));
    }
    if (this.gridApi) {
      this.gridApi.refreshHeader();
    }
  }

  onActivityChanged(event: any) {
    if (event.newValue) {
      const selectedProgram = this.workProgramData.find(item => item.id === event.newValue);
      if (selectedProgram) {
        event.data.startDate = selectedProgram.startDate;
        event.data.endDate = selectedProgram.endDate;
        event.data.routeCritic = selectedProgram.criticRoute;
        event.data.idFase = selectedProgram.phase;
        this.gridApi.refreshCells({
          rowNodes: [event.node],
          columns: ['startDate', 'endDate', 'routeCritic', 'idProgram']
        });
        this.onCellValueChanged(event);
      }
    }
  }

// Column Definitions: Defines the columns to be displayed.
public gridOptions: any = {
  headerHeight: 30,
  rowHeight: 30,
  rowClass: (params) => {
    // Verificar si la fila está seleccionada
    if (params.node.isSelected()) {
      return 'selected-row';
    }
    return '';
  },
  onRowClicked: (event) => {
    // Seleccionar la fila al hacer clic en cualquier celda
    event.node.setSelected(true);
  },
  onRowSelected: (event) => {
    // Deseleccionar otras filas cuando se selecciona una nueva
    if (event.node.isSelected()) {
      this.gridApi.forEachNode((node) => {
        if (node.id !== event.node.id) {
          node.setSelected(false);
        }
      });
    }
  },
};
  
  get columnDefs(): ColDef[] {
    return [
      {
        field: 'id',
        headerName: '# Riesgo',
        editable: true,
        width: 70
      },
      {
        field: 'idProgram',
        headerName: 'Programa de trabajo',
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.workProgramData.map(item => item.id),
        },
        valueFormatter: (params) => {
          const foundItem = this.workProgramData.find(item => item.id === params.value);
          return foundItem ? `${foundItem.activity} - ${foundItem.text}` : '';
        },
        onCellValueChanged: this.onActivityChanged.bind(this),
        cellRenderer: (params) => {
          const foundItem = this.workProgramData.find(item => item.id === params.value);
          return foundItem ? `${foundItem.activity} - ${foundItem.text}` : '';
        },
        width: 150
      },
      {
        field: 'startDate',
        headerName: 'Fecha de inicio',
        editable: false,
        width: 160,
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
        headerName: 'Fecha de fin',
        editable: false,
        width: 160,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'routeCritic',
        headerName: 'Ruta crítica',
        editable: false,
        width: 130
      },
      {
        field: 'probability',
        headerName: 'Probabilidad',
        editable: true,
        width: 130,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 1,
          max: 5,
          precision: 0,
          step: 1
        }
      },
      {
        field: 'scope',
        headerName: 'Alcance',
        editable: true,
        width: 130,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 1,
          max: 5,
          precision: 0,
          step: 1
        }
      },
      {
        field: 'time',
        headerName: 'Tiempo',
        editable: true,
        width: 130,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 1,
          max: 5,
          precision: 0,
          step: 1
        }
      },
      {
        field: 'cost',
        headerName: 'Costo',
        editable: true,
        width: 130,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 1,
          max: 5,
          precision: 0,
          step: 1
        }
      },
      {
        field: 'quality',
        headerName: 'Caliidad',
        editable: true,
        width: 130,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 1,
          max: 5,
          precision: 0,
          step: 1
        }
      },
      {
        field: 'average',
        headerName: 'Impacto promedio',
        editable: false,
        width: 130,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 1,
          max: 5,
          precision: 0,
          step: 1
        }
      },
      {
        field: 'calification',
        headerName: 'Calificación',
        editable: false,
        width: 130,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 1,
          max: 5,
          precision: 0,
          step: 1
        }
      },
      {
        field: 'urgency',
        headerName: 'Urgencia',
        editable: false,
        width: 160,
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
        field: 'idFase',
        headerName: 'Fase',
        editable: false,
        width: 100
      },
      {
        field: 'answer',
        headerName: 'Respuesta',
        editable: true,
        width: 150
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
    this.signalsService.setIdAnalysisRisk(this.selectedRowData.id);
    
    // Nueva señal para enviar los datos del programa de trabajo
    if (this.selectedRowData.idProgram) {
      const foundItem = this.workProgramData.find(item => item.id === this.selectedRowData.idProgram);
      if (foundItem) {
        this.signalsService.setSelectedWorkProgram(`${foundItem.activity} - ${foundItem.text}`);
      }
    } else {
      this.signalsService.setSelectedWorkProgram(null);
    }
    
    // Borramos las demas signals
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
      idIdentification: this.idIdentificationRisk,
      idProject: this.idProject,
      idProgram: null,
      startDate: "",
      endDate: "",
      routeCritic: "",
      probability: 0,
      scope: 0,
      time: 0,
      cost: 0,
      quality: 0,
      average: null,
      calification: null,
      urgency: "",
      idFase: "",
      answer: "",
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
      return this.riskMatrixService.addAnalysisRisk(cleanedData);
    });
  
    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      return this.riskMatrixService.updateAnalysisRisk(row.id, cleanedData);
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
    this.riskMatrixService.deleteAnalysisRisk(id).pipe(
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
