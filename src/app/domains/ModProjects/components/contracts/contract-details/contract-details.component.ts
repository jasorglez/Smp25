import { Component, effect, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { SignalsService } from 'app/services/signals.service';
import { TimeService } from 'app/services/time.service';
import { lastValueFrom, concat, toArray, catchError, EMPTY } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FollowprojectsService } from 'app/services/followprojects.service';
import { AttachHandlerService } from 'app/services/attach-handler.service';
import { SafePipe } from 'app/shared/pipes/safe.pipe';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-contract-details',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SafePipe],
  templateUrl: './contract-details.component.html',
  styleUrl: './contract-details.component.scss'
})
export class ContractDetailsComponent {
  private trackingService = inject(TrackingService);
  private employeesxloansService = inject(EmployeesxloansService);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);
  private followProjectsService = inject(FollowprojectsService);
  private attachHandlerService = inject(AttachHandlerService);

  defaultColDef = {
    flex: 1,
    resizable: true,
    sortable: true,
    filter: true,
    editable: (params) => {
      // Permitir edición solo si la fila es nueva
      return params.data?.__isNew === true;
    },
  };

  maestroRowData: any[] = [];
  detalleRowData: any[] = [];
  loanIds: number;
  gridApi: any;
  idContract: number;
  idLoan: number = null;
  nameLoan: string = null;
  id: number;
  userRoot: number = 0;
  authorizedPass: boolean = false;
  masterNotSavedChanges: boolean = false;
  detailNotSavedChanges: boolean = false;
  selectedLoanId: any;
  private tempIdCounter: number = 0;
  masterNewlyAddedRows: string[] = [];
  detailedNewlyAddedRows: string[] = [];
  private selectedLoanIdBeforeRefresh: number;
  selectedDocumentUrl: string = null;

  ngOnInit() { }

  constructor() {
    effect(() => {
      this.idContract = this.signalsService.getIdContract()();
      console.log(this.idContract);
      this.loadData();
    });
  }

  public maestroGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onMaestroRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onMaestroRowSelected: (event) => {
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

  loadData(preserveSelection: boolean = false) {

    this.followProjectsService
      .getContractDetails(this.idContract)
      .subscribe(
        (maestroRowData: any[]) => {
          if (!maestroRowData || maestroRowData.length === 0) {
            this.maestroRowData = this.detalleRowData = [];
          } else {
            this.maestroRowData = maestroRowData;

            console.log(this.maestroRowData);

            setTimeout(() => {
              if (this.maestroGridApi && this.maestroRowData.length > 0) {
                // Buscar la fila que coincide con el ID guardado
                const rowToSelect =
                  preserveSelection && this.selectedLoanIdBeforeRefresh
                    ? this.maestroRowData.findIndex(
                      (row) => row.id === this.selectedLoanIdBeforeRefresh
                    )
                    : 0;

                this.maestroGridApi
                  .getDisplayedRowAtIndex(rowToSelect)
                  ?.setSelected(true);

                // Restablecer el ID guardado
                this.selectedLoanIdBeforeRefresh = null;
              }
            });
          }
        },
        (error) => {
          console.error('Error loading loans data:', error);
        }
      );
  }


  maestroColumnDefs: ColDef[] = [
    {
      headerName: 'Nombre Documento',
      field: 'documentName',
      flex: 1,
      editable: true
    },
    {
      headerName: 'Añadir/Actualizar documento',
      field: 'urlDocument',
      flex: 1,
      cellRenderer: (params) => {
        if (params.value) {
          return `<img src="assets/img/pdf.png" alt="PDF" style="width: 24px; height: 24px;">`;
        }
        return '';
      },
      onCellDoubleClicked: async (params) => {
        try {
          const url = await this.attachHandlerService.uploadPdf();
          params.node.setDataValue('urlDocument', url);
          this.masterNotSavedChanges = true;
        } catch (error) {
          console.error('Error al subir el documento:', error);
        }
      }
    }
  ];

  private maestroGridApi: GridApi;

  private async getTime(): Promise<{ dateObj: Date; formatted: string }> {
    const time = await lastValueFrom(this.timeService.getTime());
    const date = new Date(time.localTime);
    return {
      dateObj: date,
      formatted: `${('0' + date.getDate()).slice(-2)}-${(
        '0' +
        (date.getMonth() + 1)
      ).slice(-2)}-${date.getFullYear()}`,
    };
  }

  async addRow(type: string) {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo contract details', 'Proyectos', this.trackingService.getEmail());
    const tempId = `temp_${this.tempIdCounter++}`;
    const timeData = await this.getTime();

    const newRow = {
      id: tempId,
      idContract: this.idContract,
      documentName: null,
      urlDocument: null,
      __isNew: true,
      active: true,
    };
    this.maestroRowData = [newRow, ...this.maestroRowData];
    this.masterNotSavedChanges = true;

    setTimeout(() => {
      if (this.maestroGridApi) {
        const rowNode = this.maestroGridApi.getDisplayedRowAtIndex(0);
        rowNode?.setSelected(true);

        this.maestroGridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'documentName',
        });
      }
    });
  }

  onMaestroGridReady(params: GridReadyEvent) {
    this.maestroGridApi = params.api;
  }

  onMaestroSelectionChanged(event: SelectionChangedEvent) {
    const selectedRows = this.maestroGridApi.getSelectedRows();
    if (selectedRows.length > 0) {
      const selectedMaestro = selectedRows[0];
      this.selectedDocumentUrl = selectedMaestro.urlDocument;
    } else {
      this.selectedDocumentUrl = null;
    }
  }

  async saveMasterChanges() {
    const isValid = this.maestroRowData.every((item) => item.urlDocument && item.documentName);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe ingresar nombre y documento.',
        'error'
      );
      return;
    }

    const newRows = this.maestroRowData.filter((row) => row.__isNew);
    const modifiedRows = this.maestroRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.followProjectsService.addContractDetails(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.followProjectsService.updateContractDetails(row.id, cleanedData);
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
      this.masterNotSavedChanges = false;
      await this.loadData(); // Refrescar los datos
      this.signalsService.triggerRefreshEmployees();
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  revertMasterData() {
    this.loadData();
    this.masterNotSavedChanges = false;
  }

  onMasterCellValueChanged(event: any): void {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.masterNotSavedChanges = true;
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

  async deleteMasterEntry() {
    const selectedNodes = this.maestroGridApi.getSelectedNodes();
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

    this.followProjectsService
      .deleteContractDetails(id)
      .pipe(
        catchError((error) => {
          // Verificar si el error es un 400 y mostrar un mensaje específico
          if (error.status === 400) {
            alerts.basicAlert(
              'Eliminar entrada',
              error.error.message || 'Error al eliminar la entrada.',
              'error'
            );
          } else {
            alerts.basicAlert(
              'Eliminar entrada',
              'Error al eliminar la entrada.',
              'error'
            );
          }
          console.error(error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.loadData();

        alerts.basicAlert(
          'Eliminar entrada',
          'Entrada eliminada satisfactoriamente.',
          'success'
        );
        this.masterNotSavedChanges = false;
      });
  }
}
