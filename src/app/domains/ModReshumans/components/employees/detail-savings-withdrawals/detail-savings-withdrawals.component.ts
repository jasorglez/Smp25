import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { AuthService } from 'app/services/auth.service';
import { TimeService } from 'app/services/time.service';
import { SignalsService } from 'app/services/signals.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-detail-savings-withdrawals',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="p-1">
      <div class="d-flex justify-content-end gap-1 mb-1">
        <button type="button" class="btn btn-sm btn-primary"
          (click)="addRow()"
          *ngIf="authService.getCrudPermissionDetail('hr', seccion, subSeccion, 'create')">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button type="button" class="btn btn-sm btn-success position-relative"
          (click)="saveDetailChanges()"
          *ngIf="authService.getCrudPermissionDetail('hr', seccion, subSeccion, 'create') || authService.getCrudPermissionDetail('hr', seccion, subSeccion, 'update')">
          <i class="bi bi-floppy"></i>
          <span class="position-absolute top-0 end-0 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="detailNotSavedChanges">
            <span class="visually-hidden">Hay cambios sin guardar</span>
          </span>
        </button>
        <button type="button" class="btn btn-sm btn-warning" (click)="revertDetailData()">
          <i class="bi bi-arrow-clockwise"></i>
        </button>
        <button type="button" class="btn btn-sm btn-danger"
          (click)="deleteDetalleEntry()"
          *ngIf="authService.getCrudPermissionDetail('hr', seccion, subSeccion, 'delete')">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        style="width: 100%; height: 180px;"
        [rowData]="detalleRowData"
        [columnDefs]="detalleColumnDefs"
        [defaultColDef]="defaultColDef"
        (gridReady)="onDetalleGridReady($event)"
        [rowSelection]="'single'"
        (cellValueChanged)="onDetailCellValueChanged($event)"
        [stopEditingWhenCellsLoseFocus]="true">
      </ag-grid-angular>
    </div>
  `,
})
export class DetailSavingsWithdrawalsComponent {
  private employeesxloansService = inject(EmployeesxloansService);
  private timeService = inject(TimeService);
  private signalsService = inject(SignalsService);
  authService = inject(AuthService);

  idLoan: number = null;
  seccion: string = 'employees';
  subSeccion: string = 'Emp_Aho';
  detalleRowData: any[] = [];
  private detalleGridApi: GridApi;
  detailNotSavedChanges: boolean = false;
  private tempIdCounter: number = 0;
  private refreshMaster: ((id?: number) => void) | null = null;

  defaultColDef = {
    flex: 1,
    resizable: true,
    sortable: true,
    filter: true,
  };

  detalleColumnDefs: ColDef[] = [
    {
      headerName: 'Fecha',
      field: 'date',
      valueGetter: (params) => params.data.date ? new Date(params.data.date) : null,
      cellEditor: 'agDateCellEditor',
      cellEditorParams: { min: new Date(2000, 0, 1), max: new Date(2050, 11, 31) },
      valueFormatter: (params) => {
        if (params.value) {
          const d = new Date(params.value);
          return `${('0' + d.getDate()).slice(-2)}-${('0' + (d.getMonth() + 1)).slice(-2)}-${d.getFullYear()}`;
        }
        return '';
      },
      flex: 1,
      editable: (params) => params.data.__isNew || this.authService.getCrudPermissionDetail('hr', this.seccion, this.subSeccion, 'update'),
    },
    {
      headerName: 'Retiro *',
      headerClass: 'required-header',
      field: 'total',
      valueFormatter: (params) => params.value
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
        : '$0.00',
      flex: 2,
      editable: (params) => params.data.__isNew || this.authService.getCrudPermissionDetail('hr', this.seccion, this.subSeccion, 'update'),
    },
    {
      headerName: 'Comentario',
      field: 'descripcion',
      flex: 1,
      editable: (params) => params.data.__isNew || this.authService.getCrudPermissionDetail('hr', this.seccion, this.subSeccion, 'update'),
    },
  ];

  agInit(params: any) {
    this.idLoan = params.data?.id ?? null;
    this.refreshMaster = params.context?.refreshMaster ?? null;
    if (params.context?.getSeccion) this.seccion = params.context.getSeccion();
    if (params.context?.getSubSeccion) this.subSeccion = params.context.getSubSeccion();
    this.loadDetailedData();
  }

  onDetalleGridReady(params: GridReadyEvent) {
    this.detalleGridApi = params.api;
  }

  onDetailCellValueChanged(event: any) {
    event.data.__modified = true;
    this.detailNotSavedChanges = true;
  }

  loadDetailedData() {
    if (this.idLoan == null) return;
    this.employeesxloansService.getConceptsxLoansCredit(this.idLoan).subscribe(
      (data) => {
        this.detalleRowData = data ?? [];
        setTimeout(() => {
          if (this.detalleGridApi && this.detalleRowData.length > 0) {
            this.detalleGridApi.getDisplayedRowAtIndex(0)?.setSelected(true);
          }
        });
      },
      (error) => {
        console.error('Error loading detailed savings data:', error);
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
      }
    );
  }

  private async getTime(): Promise<Date> {
    const time = await lastValueFrom(this.timeService.getTime());
    return new Date(time.localTime);
  }

  async addRow() {
    const date = await this.getTime();
    const tempId = `temp_${this.tempIdCounter++}`;
    const newRow = {
      id: tempId,
      idLoanAndCredit: this.idLoan,
      date,
      status: 'Pendiente',
      total: 0,
      comments: '',
      __isNew: true,
      active: true,
    };
    this.detalleRowData = [newRow, ...this.detalleRowData];
    this.detailNotSavedChanges = true;
    setTimeout(() => {
      if (this.detalleGridApi) {
        this.detalleGridApi.getDisplayedRowAtIndex(0)?.setSelected(true);
        this.detalleGridApi.startEditingCell({ rowIndex: 0, colKey: 'total' });
      }
    });
  }

  async saveDetailChanges() {
    const isValid = this.detalleRowData.every((item) => item.total);
    if (!isValid) {
      alerts.basicAlert('Añadir entrada', 'Debe ingresar un valor de retiro.', 'error');
      return;
    }
    const newRows = this.detalleRowData.filter((row) => row.__isNew);
    const modifiedRows = this.detalleRowData.filter((row) => row.__modified && !row.__isNew);
    const addObservables = newRows.map((row) =>
      this.employeesxloansService.addConcept(this.cleanDataForServer(row))
    );
    const updateObservables = modifiedRows.map((row) =>
      this.employeesxloansService.updateConcept(row.id, this.cleanDataForServer(row))
    );
    try {
      await lastValueFrom(concat(...addObservables, ...updateObservables).pipe(toArray()));
      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.detailNotSavedChanges = false;
      this.loadDetailedData();
      this.refreshMaster?.(this.idLoan);
      this.signalsService.triggerRefreshEmployees();
    } catch (error) {
      if (error.status === 400) {
        alerts.basicAlert('Añadir entrada', error.error.message || 'Error al actualizar los datos.', 'error');
      } else {
        alerts.basicAlert('Error', 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.', 'error');
      }
      console.error(error);
    }
  }

  revertDetailData() {
    this.loadDetailedData();
    this.detailNotSavedChanges = false;
  }

  async deleteDetalleEntry() {
    const selectedNodes = this.detalleGridApi?.getSelectedNodes();
    if (!selectedNodes?.length) {
      alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione una entrada para eliminar.', 'error');
      return;
    }
    const id = selectedNodes[0].data.id;
    this.employeesxloansService.deleteConcept(id)
      .pipe(catchError((error) => {
        alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
        console.error(error);
        return EMPTY;
      }))
      .subscribe(() => {
        alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
        this.detailNotSavedChanges = false;
        this.loadDetailedData();
        this.refreshMaster?.(this.idLoan);
        this.signalsService.triggerRefreshEmployees();
      });
  }

  private cleanDataForServer(data: any): any {
    const clean = { ...data };
    delete clean.__isNew;
    delete clean.__modified;
    if (clean.id?.toString().startsWith('temp_')) delete clean.id;
    return clean;
  }
}
