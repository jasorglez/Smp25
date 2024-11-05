import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
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
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-identification-risk',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, RisksInfoComponent, MultiLineEditorComponent],
  templateUrl: './identification-risk.component.html',
  providers: [DatePipe]
})
export class IdentificationRiskComponent implements OnInit {

  private riskMatrixService = inject(RiskmatrixService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);
  private datePipe = inject(DatePipe);  
  idProject: number = null;
  idIdentificationRisk = this.signalsService.getIdIdentificationRisk()();
  fecha: string;  
  

  constructor() {
    effect(() => {
      this.idProject = this.signalsService.getProjectSelectedBySidebar()();
      console.log(this.idProject);
      this.idIdentificationRisk = this.signalsService.getIdIdentificationRisk()();
      if (this.idProject == null) {
        this.rowData = [];
        alerts.basicAlert('Matriz Riesgos', 'Debe elegir un proyecto primero.', 'error');
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

  ngOnInit(): void {
    // Formatear la fecha actual al formato yyyy-MM-dd
    this.fecha = this.datePipe.transform(new Date(), 'yyyy-MM-dd');
  }

  onFechaChange() {
    this.obtenerDatos();
  }

  obtenerDatos() {
    this.riskMatrixService
      .getIdentificationRisks(this.idProject, this.fecha)
      .pipe(
        catchError((error) => {
          console.error('Error al obtener identificaciones:', error);
          this.rowData = []; // Asigna un array vacío en caso de error
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

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'id',
        headerName: '# Riesgo',
        editable: false,
        width: 100
      },
      {
        field: 'classification',
        headerName: 'Clasificación',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: ['Administrativo', 'Técnico'],
        },
        flex: 2,
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: false,
        flex: 3,
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
        field: 'cause',
        headerName: 'Causa',
        editable: false,
        flex: 3,
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
        field: 'typeRisk',
        headerName: 'Tipo de riesgo',
        editable: true,
        flex: 2,
      },
      {
        field: 'ownerRisk',
        headerName: 'Dueño de riesgo',
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

  onCellValueChanged(event: any) {
    this.setSignals();
    event.data.__modified = true;
    this.notSavedChanges = true;
    
    // Añadir esta comprobación
    if (this.newlyAddedRows.includes(event.data.id)) {
      const index = this.rowData.findIndex(row => row.id === event.data.id);
      if (index !== -1) {
        this.rowData[index] = { ...this.rowData[index], ...event.data };
      }
    }
  }

  setSignals() {
    if (this.selectedRowData && !this.newlyAddedRows.includes(this.selectedRowData.id)) {
      this.signalsService.setIdIdentificationRisk(this.selectedRowData.id);
      this.signalsService.setNameIdentificationRisk(this.selectedRowData.description);
      this.signalsService.setCauseIdentificationRisk(this.selectedRowData.cause);
    }
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
      idProject: this.idProject,
      classification: "",
      date: this.fecha,
      typeRisk: "",
      ownerRisk: "",
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
      return this.riskMatrixService.addIdentificationRisk(cleanedData);
    });
  
    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log(cleanedData);
      return this.riskMatrixService.updateIdentificationRisk(row.id, cleanedData);
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
    this.riskMatrixService.deleteIdentificationRisk(id).pipe(
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
          this.signalsService.setIdIdentificationRisk(null);
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
