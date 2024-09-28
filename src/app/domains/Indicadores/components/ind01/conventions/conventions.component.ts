import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AgGridModule } from 'ag-grid-angular';
import { GridApi, ColDef, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { Icontract } from 'app/interface/icontract';
import { ConventionsService } from 'app/services/conventions.service';
import { lastValueFrom, concat, toArray, catchError, EMPTY, throwError } from 'rxjs';
import { ContractsService } from 'app/services/contracts.service';

@Component({
  selector: 'app-conventions',
  standalone: true,
  imports: [DomainsModule, CommonModule, FormsModule, AgGridModule],
  templateUrl: './conventions.component.html',
  styleUrl: './conventions.component.scss'
})
export class ConventionsComponent {

  private conventionsService = inject(ConventionsService);
  private contractsService = inject(ContractsService);

  ngOnInit() {
    this.obtenerDatos();
    this.getContracts();
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
    this.conventionsService
      .getConventions()
      .subscribe((data: any) => {
        this.rowData = data;
      });
  }

  getContracts() {
      this.contractsService.getContracts(1).subscribe((data: any[]) => {
        this.contracts = data.reduce((acc, dep) => {
          acc[dep.idContrato] = dep.numberContract + ' - ' + dep.descripSmall; // Cambia la estructura para que solo almacene el nombre
          return acc;
        }, {});
      });
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'name',
        headerName: 'Nombre',
        editable: true,
        flex: 1
      },
      {
        field: 'description',
        headerName: 'Descripción',
        editable: true,
        flex: 2
      },
      {
        field: 'idContract',
        headerName: 'Contrato',
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: Object.keys(this.contracts).sort((a, b) => this.contracts[a].localeCompare(this.contracts[b])),
        },
        valueFormatter: (params) => this.contracts[params.value] || '',
        valueSetter: (params) => {
          const newValue = params.newValue;
          if (this.contracts.hasOwnProperty(newValue)) {
            params.data[params.colDef.field] = newValue;
            return true;
          }
          return false;
        },
        valueParser: (params) => params.newValue,
        editable: true,
        flex: 2,
      },
      {
        field: 'start',
        headerName: 'Fecha inicio',
        editable: true,
        cellDataType: 'dateString',
        flex: 1,
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'end',
        headerName: 'Fecha fin',
        editable: true,
        cellDataType: 'dateString',
        flex: 1,
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'amountMX',
        headerName: 'Monto MXN',
        editable: true,
        cellDataType: 'number',
        valueFormatter: params => {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
          }).format(params.value);
        },
        flex: 1
      },
      {
        field: 'amountDLL',
        headerName: 'Monto USD',
        editable: true,
        cellDataType: 'number',
        valueFormatter: params => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(params.value);
        },
        flex: 1
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        editable: true,
        flex: 2
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
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
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
      contractId: 1,
      name: '',
      direccion: '',
      coordinates: '',
      active: 1,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) =>
      item.name && item.description && item.idContract && item.start && item.end);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
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
      return this.conventionsService.addConvention(cleanedData).pipe(
        catchError((error) => {
          console.error('Error adding agreement:', error);
          return throwError(() => new Error(`Error al añadir acuerdo: ${error.message}`));
        })
      );
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.conventionsService.updateConvention(row.id, cleanedData).pipe(
        catchError((error) => {
          console.error('Error updating agreement:', error);
          return throwError(() => new Error(`Error al actualizar acuerdo: ${error.message}`));
        })
      );
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(
          toArray(),
          catchError((error) => {
            console.error('Error in observable chain:', error);
            return throwError(() => new Error(`Error en la operación: ${error.message}`));
          })
        )
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
        `Ocurrió un error al actualizar los datos: ${error.message}. Por favor, intente nuevamente.`,
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
    this.conventionsService.deleteConvention(id).pipe(
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
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

}
