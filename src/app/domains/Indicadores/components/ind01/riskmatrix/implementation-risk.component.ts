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
  selector: 'app-implementation-risk',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, RisksInfoComponent, MultiLineEditorComponent, RisksInfoComponent],
  templateUrl: './sub-template-risk.component.html'
})
export class ImplementationRiskComponent {
  private riskMatrixService = inject(RiskmatrixService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);

  idProject: number = null;
  idAnalysisRisk = this.signalsService.getIdAnalysisRisk()();
  idIdentificationRisk = this.signalsService.getIdIdentificationRisk()();
  idPlanificationRisk = this.signalsService.getIdPlanificationRisk()();
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
      .getImplementationRisks(this.idPlanificationRisk)
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
        headerName: '#',
        editable: false,
        width: 70
      },
      {
        field: 'probability',
        headerName: 'Probabilidad Residual',
        cellDataType: 'number',
        editable: true,
        width: 140
      },
    {
      field: 'reach',
      headerName: 'Alcance',
      cellDataType: 'number',
      editable: true,
      width: 140
    },
    {
      field: 'time',
      headerName: 'Tiempo',
      cellDataType: 'number',
      editable: true,
      width: 140
    },
    {
      field: 'cost',
      headerName: 'Costo',
      cellDataType: 'number',
      editable: true,
      width: 140
    },
    {
      field: 'quality',
      headerName: 'Calidad',
      cellDataType: 'number',
      editable: true,
      width: 140
    },
    {
      field: 'qualification',
      headerName: 'Calificación residual',
      cellDataType: 'number',
      editable: false,
      width: 140
    },
    {
      field: 'state',
      headerName: 'Estado Plan de Respuesta',
      cellDataType: 'text',
      editable: true,
      width: 200
    },
    {
      field: 'reach',
      headerName: 'Alcance',
      cellDataType: 'number',
      editable: true,
      width: 140
    },
    {
      field: 'advancedReal',
      headerName: '% Avance Real',
      cellDataType: 'number',
      editable: true,
      width: 140
    },
    {
      field: 'advancedPlanning',
      headerName: '% Avance Planeado',
      cellDataType: 'number',
      editable: true,
      width: 140
    },
    {
      field: 'spi',
      headerName: 'SPI',
      cellDataType: 'number',
      editable: false,
      width: 140
    },
    {
      field: 'status',
      headerName: 'Estado',
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: ['ABIERTO', 'CERRADO'],
        },
        width: 140
    },
    {
      field: 'condition',
      headerName: 'Condición Disparadora',
      cellDataType: 'text',
      editable: true,
      width: 200
    },
    {
      field: 'dateClose',
      headerName: 'Fecha de cierre',
      editable: true,
      width: 200,
      cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
    },
    {
      field: 'observation',
      headerName: 'Observación',
      cellDataType: 'text',
      editable: true,
      width: 200
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
      idPlanification: this.idPlanificationRisk,
      probability: 0,
      reach: 0,
      time: 0,
      cost: 0,
      quality: 0,
      qualification: null,
      state: '',
      advancedReal: 0,
      advancedPlanning: 0, 
      status: '',
      condition: '',
      dateClose: '',
      observation: '',
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
      return this.riskMatrixService.addImplementationRisk(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      return this.riskMatrixService.updateImplementationRisk(row.id, cleanedData);
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
    this.riskMatrixService.deleteImplementationRisk(id).pipe(
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
