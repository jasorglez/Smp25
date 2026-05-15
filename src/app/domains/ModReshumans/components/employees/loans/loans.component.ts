import { CommonModule } from '@angular/common';
import { Component, effect, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { SignalsService } from 'app/services/signals.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { TimeService } from 'app/services/time.service';
import { TrackingService } from 'app/services/tracking.service';
import { AuthService } from 'app/services/auth.service';
import { DetailLoanPaymentsComponent } from '../detail-loan-payments/detail-loan-payments.component';

@Component({
  selector: 'app-employeesxloans',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './loans.component.html',
  styleUrl: './loans.component.scss',
})
export class EmployeesxLoansComponent {
  private employeesxloansService = inject(EmployeesxloansService);
  private signalsService = inject(SignalsService);
  private timeService = inject(TimeService);
  private trackingService = inject(TrackingService);
  authService = inject(AuthService);

  defaultColDef = {
    flex: 1,
    resizable: true,
    sortable: true,
    filter: true,
    editable: (params) => params.data?.__isNew === true,
  };

  userRoot: number = 0;
  authorizedPass: boolean = false;
  maestroRowData: any[] = [];
  gridApi: any;
  idEmployee: number;
  id: number;
  masterNotSavedChanges: boolean = false;
  private tempIdCounter: number = 0;
  masterNewlyAddedRows: string[] = [];
  externalIdEmployee = input<number | null>(null);

  ngOnInit() {}

  constructor() {
    effect(() => {
      const extId = this.externalIdEmployee();
      if (extId != null) {
        this.idEmployee = extId;
        this.loadData();
        this.authorizedPass = false;
        return;
      }
      this.idEmployee = this.signalsService.getIdEmployee()();
      this.userRoot = this.signalsService.getUserRoot()();
      this.loadData();
      this.authorizedPass = this.userRoot == 1;
    });
  }

  components = { detailLoanPayments: DetailLoanPaymentsComponent };

  public maestroGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    masterDetail: true,
    isRowMaster: () => true,
    detailCellRendererSelector: () => ({ component: 'detailLoanPayments' }),
    detailRowHeight: 250,
    context: { refreshMaster: (id?: number) => this.loadData(id) },
    onCellClicked: (params: any) => {
      if (params.column.getColId() !== 'expandBtn') return;
      if (params.data?.__isNew) return;
      const rowNode = params.node;
      if (rowNode.expanded) {
        rowNode.setExpanded(false);
        params.api.setFilterModel(null);
        params.api.onFilterChanged();
      } else {
        params.api.setFilterModel({ id: { filterType: 'number', type: 'equals', filter: params.data.id } });
        params.api.onFilterChanged();
        rowNode.setExpanded(true);
      }
      params.api.refreshCells({ rowNodes: [rowNode], columns: ['expandBtn'], force: true });
    },
    onRowGroupOpened: (event: any) => {
      if (!event.expanded) {
        event.api.setFilterModel(null);
      }
    },
    getRowClass: (params) => params.node.isSelected() ? 'selected-row' : '',
  };

  loadData(selectId?: number) {
    if (this.idEmployee === null || this.idEmployee === undefined) return;

    this.employeesxloansService
      .getLoansByEmployee(this.idEmployee, 'PRESTAMO')
      .subscribe(
        (maestroRowData: any[]) => {
          if (!maestroRowData || maestroRowData.length === 0) {
            this.maestroRowData = [];
          } else {
            this.maestroRowData = maestroRowData;
            setTimeout(() => {
              if (this.maestroGridApi && this.maestroRowData.length > 0) {
                const rowToSelect = selectId
                  ? this.maestroRowData.findIndex((row) => row.id === selectId)
                  : 0;
                this.maestroGridApi
                  .getDisplayedRowAtIndex(rowToSelect < 0 ? 0 : rowToSelect)
                  ?.setSelected(true);
              }
            });
          }
          this.trackingService.addLog(this.trackingService.getnameComp(), 'Get Registro en Prestamos', 'Menu Recursos Humanos Prestamos', this.trackingService.getEmail());
        },
        (error) => console.error('Error loading loans data:', error)
      );
  }

  maestroColumnDefs: ColDef[] = [
    {
      headerName: 'ID',
      field: 'id',
      flex: 1,
      editable: false,
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => {
        if (params.value && params.value.toString().startsWith('temp_')) return '';
        return params.value;
      },
    },
    {
      headerName: 'Fecha',
      field: 'date',
      flex: 2,
      valueGetter: (params) => params.data.date ? new Date(params.data.date) : null,
      cellRenderer: 'agDateCellRenderer',
      cellEditor: 'agDateCellEditor',
      valueFormatter: (params) => {
        if (params.value) {
          const date = new Date(params.value);
          return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
        }
        return '';
      },
      editable: (params) => {
        if (params.data.__isNew) return true;
        return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_Pre', 'update');
      },
    },
    {
      headerName: 'Préstamo *',
      headerClass: 'required-header',
      field: 'monto',
      flex: 2,
      valueFormatter: (params) => params.value
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
        : '',
      editable: (params) => {
        if (params.data.__isNew) return true;
        return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_Pre', 'update');
      },
    },
    {
      headerName: 'Pagado',
      field: 'payments',
      flex: 2,
      valueFormatter: (params) => params.value
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
        : '$0.00',
      editable: false,
    },
    {
      headerName: 'Restante',
      field: 'remain',
      flex: 2,
      valueFormatter: (params) => params.value
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
        : '$0.00',
      editable: false,
    },
    {
      headerName: 'Comentario',
      field: 'comments',
      flex: 4,
      editable: (params) => {
        if (params.data.__isNew) return true;
        return this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_Pre', 'update');
      },
    },
    {
      headerName: '',
      colId: 'expandBtn',
      valueGetter: () => '',
      flex: 1,
      editable: false,
      sortable: false,
      filter: false,
      cellRenderer: (params) => {
        if (params.data?.__isNew) return '';
        const active = params.node.expanded;
        return `<button class="btn btn-xs btn-${active ? 'info' : 'outline-info'}" style="font-size:11px;padding:1px 6px;">Ver abonos</button>`;
      },
    },
  ];

  private maestroGridApi: GridApi;

  private async getTime(): Promise<{ dateObj: Date; formatted: string }> {
    const time = await lastValueFrom(this.timeService.getTime());
    const date = new Date(time.localTime);
    return {
      dateObj: date,
      formatted: `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`,
    };
  }

  async addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const timeData = await this.getTime();
    const newRow = {
      id: tempId,
      idEmpleado: this.idEmployee,
      date: timeData.dateObj,
      type: 'PRESTAMO',
      monto: 0,
      payments: 0,
      __isNew: true,
      active: true,
    };
    this.maestroRowData = [newRow, ...this.maestroRowData];
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Add Registro en Prestamos', 'Menu Administracion Prestamos', this.trackingService.getEmail());
    this.masterNotSavedChanges = true;
    setTimeout(() => {
      if (this.maestroGridApi) {
        this.maestroGridApi.getDisplayedRowAtIndex(0)?.setSelected(true);
        this.maestroGridApi.startEditingCell({ rowIndex: 0, colKey: 'monto' });
      }
    });
  }

  onMaestroGridReady(params: GridReadyEvent) {
    this.maestroGridApi = params.api;
    setTimeout(() => this.maestroGridApi.autoSizeAllColumns(false), 0);
  }

  async saveMasterChanges() {
    const isValid = this.maestroRowData.every((item) => item.monto);
    if (!isValid) {
      alerts.userSaveErrorToast('Añadir entrada', 'Debe ingresar un valor de préstamo.');
      return;
    }
    const newRows = this.maestroRowData.filter((row) => row.__isNew);
    const modifiedRows = this.maestroRowData.filter((row) => row.__modified && !row.__isNew);
    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Add Registro en Prestamos', 'Menu Administracion Prestamos', this.trackingService.getEmail());
      return this.employeesxloansService.addLoan(cleanedData);
    });
    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Update Registro en Prestamos', 'Menu Administracion Prestamos', this.trackingService.getEmail());
      return this.employeesxloansService.updateLoan(row.id, cleanedData);
    });
    try {
      await lastValueFrom(concat(...addObservables, ...updateObservables).pipe(toArray()));
      alerts.userSaveSuccessToast('Préstamos', 'Se han actualizado los datos correctamente.');
      this.masterNotSavedChanges = false;
      this.masterNewlyAddedRows = [];
      await this.loadData();
      this.signalsService.triggerRefreshEmployees();
    } catch (error) {
      console.error(error);
      alerts.userSaveErrorToast('Error', 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.');
    }
  }

  revertMasterData() {
    this.loadData();
    this.masterNotSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Revertir Registro en Prestamos', 'Menu Administracion Prestamos', this.trackingService.getEmail());
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
      alerts.userSaveErrorToast('Eliminar entrada', 'Por favor, seleccione una entrada para eliminar.');
      return;
    }
    const id = selectedNodes[0].data.id;
    this.employeesxloansService
      .deleteLoan(id)
      .pipe(
        catchError((error) => {
          if (error.status === 400) {
            alerts.userSaveErrorToast('Eliminar entrada', error.error.message || 'Error al eliminar la entrada.');
          } else {
            alerts.userSaveErrorToast('Eliminar entrada', 'Error al eliminar la entrada.');
          }
          console.error(error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.userDeleteSuccessToast('Eliminar entrada', 'Entrada eliminada satisfactoriamente.');
        this.loadData();
        this.masterNotSavedChanges = false;
        this.trackingService.addLog(this.trackingService.getnameComp(), 'Delete Registro en Prestamos', 'Menu Administracion Prestamos', this.trackingService.getEmail());
        this.signalsService.triggerRefreshEmployees();
      });
  }
}
