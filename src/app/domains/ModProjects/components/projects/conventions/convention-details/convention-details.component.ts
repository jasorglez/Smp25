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
import { ConventionsService } from 'app/services/conventions.service';

@Component({
  selector: 'app-convention-details',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SafePipe],
  templateUrl: './convention-details.component.html',
  styleUrl: './convention-details.component.scss'
})
export class conventionDetailsComponent {
  private employeesxloansService = inject(EmployeesxloansService);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);
  private followProjectsService = inject(FollowprojectsService);
  private attachHandlerService = inject(AttachHandlerService);
  private conventionsService = inject(ConventionsService);

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
  idConvention: number;
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

  ngOnInit() {
    this.idConvention = this.signalsService.getIdConvention()();
      this.loadData();
  }

  constructor() {
    effect(() => {
      this.idConvention = this.signalsService.getIdConvention()();
      this.loadData();
    });
  }

  public maestroGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onMaestroRowClicked: (event) => {
      event.node.setSelected(true);
    },
    onMaestroRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onCellKeyDown: (params) => {
      if (params.event.key === 'Enter') {
        const allColumns = this.maestroColumnDefs;
        const currentColIndex = allColumns.findIndex(
          (col) => col.field === params.column.getColDef().field
        );

        if (currentColIndex < allColumns.length - 1) {
          setTimeout(() => {
            const rowNode = params.api.getDisplayedRowAtIndex(params.node.rowIndex);
            if (rowNode) {
              rowNode.setSelected(true);
            }
            params.api.ensureIndexVisible(params.node.rowIndex);
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: allColumns[currentColIndex + 1].field,
            });
          }, 150);
        }
        params.event.preventDefault();
      }
    },
  };

  loadData(preserveSelection: boolean = false) {

    this.conventionsService
      .getConventionDetails(this.idConvention)
      .subscribe(
        (maestroRowData: any[]) => {
          if (!maestroRowData || maestroRowData.length === 0) {
            this.maestroRowData = this.detalleRowData = [];
          } else {
            this.maestroRowData = maestroRowData;


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
          this.maestroRowData = [];
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
    const tempId = `temp_${this.tempIdCounter++}`;
    const timeData = await this.getTime();

    const newRow = {
      id: tempId,
      idConvention: this.idConvention,
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
        if (rowNode) {
          rowNode.setSelected(true);
        }
        this.maestroGridApi.ensureIndexVisible(0);
        this.maestroGridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'documentName',
        });
      }
    }, 100);
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
      return this.conventionsService.addConventionDetails(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.conventionsService.updateConventionDetails(row.id, cleanedData);
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

    this.conventionsService
      .deleteConventionDetails(id)
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
