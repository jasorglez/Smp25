import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { SignalsService } from 'app/services/signals.service';
import { IssuesService } from 'app/services/issues.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-contingency-actions',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './contingency-actions.component.html',
  styleUrl: './contingency-actions.component.scss'
})
export class ContingencyActionsComponent {

  private issuesService = inject(IssuesService);
  private signalsService = inject(SignalsService);
  idAnalysis: number = 1;

  ngOnInit() {
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
  companys: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  obtenerDatos() {
    this.issuesService
      .getContingencyActions(this.idAnalysis)
      .subscribe((data: any) => {
        this.rowData = data;
        console.log(data);
      });
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'actions',
        headerName: 'Acciones',
        editable: true,
        flex: 3
      },
      {
        field: 'dateStart',
        headerName: 'Fecha de inicio',
        editable: true,
        flex: 1,
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
        headerName: 'Fecha de inicio',
        editable: true,
        flex: 1,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'period',
        headerName: 'Periodo',
        editable: true,
        flex: 1,
      },
      {
        field: 'resources',
        headerName: 'Recursos',
        editable: true,
        flex: 1,
      },
      {
        field: 'costApprox',
        headerName: 'Costo aprox.',
        cellEditor: 'agNumberCellEditor',
        editable: true,
        flex: 1,
      },
      {
        field: 'advancePlanned',
        headerName: 'Avance planeado',
        cellEditor: 'agNumberCellEditor',
        editable: true,
        flex: 1,
      },
      {
        field: 'advancedReal',
        headerName: 'Avance real',
        cellEditor: 'agNumberCellEditor',
        editable: true,
        flex: 1,
      },
      {
        field: 'advancedReal',
        headerName: 'Avance real',
        cellEditor: 'agNumberCellEditor',
        editable: true,
        flex: 1,
      },
      {
        field: 'spi',
        headerName: 'SPI',
        cellEditor: 'agNumberCellEditor',
        editable: true,
        flex: 1,
      },
      {
        field: 'days',
        headerName: 'Días',
        cellEditor: 'agNumberCellEditor',
        editable: true, 
        flex: 1,
      },
      {
        field: 'status',
        headerName: 'Estado',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
            values: ['Abierto', 'Cerrado'],
        },
        flex: 1,
      },
      {
        field: 'observations',
        headerName: 'Observaciones',
        editable: true,
        flex: 3
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
      this.enviarCompanyId();
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    this.enviarCompanyId();
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
      idAnalysis: this.idAnalysis,
      actions: null,
      dateStart: null,
      dateEnd: null,
      period: null,
      resources: null,
      costApprox: null,
      advancePlanned: null,
      advancedReal: null,
      spi: null,
      days: null,
      status: null,
      observations: null,
      active: 1
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    /*     const isValid = this.rowData.every((item) => item.idPermission);
    
        if (!isValid) {
          alerts.basicAlert(
            'Añadir entrada',
            'Debe seleccionar una compañía antes de guardar.',
            'error'
          );
          return;
        } */

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.issuesService.addContingencyAction(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.issuesService.updateContingencyAction(row.id, cleanedData);
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
    this.issuesService.deleteContingencyAction(id).pipe(
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
          this.signalsService.idCompany.set(null);
          this.signalsService.nameCompany.set(null);
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
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  enviarCompanyId() {
    const companyName = this.getCompanyName(this.selectedRowData.idPermission);
    this.signalsService.companySignal(this.selectedRowData.idPermission, companyName);
  }

  getCompanyName(id: number): string {
    return this.companys[id] || 'Departamento no encontrado';
  }


}
