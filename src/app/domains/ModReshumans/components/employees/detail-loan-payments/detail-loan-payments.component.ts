import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectorRef} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { AuthService } from 'app/services/auth.service';
import { TimeService } from 'app/services/time.service';
import { TrackingService } from 'app/services/tracking.service';
import { SignalsService } from 'app/services/signals.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-detail-loan-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div class="p-1">
      <div class="d-flex justify-content-end gap-1 mb-1">
        <button type="button" class="btn btn-sm btn-primary"
          (click)="addRow()"
          *ngIf="authService.getCrudPermissionDetail('hr', 'employees', 'Emp_Pre', 'create')">
          <i class="bi bi-plus-lg"></i>
        </button>
        <button type="button" class="btn btn-sm btn-success position-relative"
          (click)="saveDetailChanges()"
          *ngIf="authService.getCrudPermissionDetail('hr', 'employees', 'Emp_Pre', 'create') || authService.getCrudPermissionDetail('hr', 'employees', 'Emp_Pre', 'update')">
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
          *ngIf="authService.getCrudPermissionDetail('hr', 'employees', 'Emp_Pre', 'delete')">
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
export class DetailLoanPaymentsComponent {
  private employeesxloansService = inject(EmployeesxloansService);
  private readonly cdr = inject(ChangeDetectorRef);
  private timeService = inject(TimeService);
  private trackingService = inject(TrackingService);
  private signalsService = inject(SignalsService);
  authService = inject(AuthService);

  idLoan: number = null;
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
      editable: (params) => params.data.__isNew || this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_Pre', 'update'),
    },
    {
      headerName: 'Abono *',
      headerClass: 'required-header',
      field: 'total',
      valueFormatter: (params) => params.value
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value)
        : '$0.00',
      flex: 2,
      editable: (params) => params.data.__isNew || this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_Pre', 'update'),
    },
    {
      headerName: 'Comentario',
      field: 'descripcion',
      flex: 1,
      editable: (params) => params.data.__isNew || this.authService.getCrudPermissionDetail('hr', 'employees', 'Emp_Pre', 'update'),
    },
  ];

  agInit(params: any) {
    this.idLoan = params.data?.id ?? null;
    this.refreshMaster = params.context?.refreshMaster ?? null;
    this.loadDetailedData();
  
    this.cdr.detectChanges();}

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
        this.trackingService.addLog(this.trackingService.getnameComp(), 'Get Registro en Detalle de Prestamos', 'Menu Recursos Humanos Prestamos', this.trackingService.getEmail());
      },
      (error) => {
        console.error('Error loading detailed loan data:', error);
        alerts.userSaveErrorToast('Error', 'Error al cargar los datos.');
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
      alerts.userSaveErrorToast('Añadir entrada', 'Debe ingresar un valor de abono.');
      return;
    }
    const newRows = this.detalleRowData.filter((row) => row.__isNew);
    const modifiedRows = this.detalleRowData.filter((row) => row.__modified && !row.__isNew);
    const addObservables = newRows.map((row) => {
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Add Registro en Detalle de Prestamos', 'Menu Administracion Prestamos', this.trackingService.getEmail());
      return this.employeesxloansService.addConcept(this.cleanDataForServer(row));
    });
    const updateObservables = modifiedRows.map((row) => {
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Update Registro en Detalle de Prestamos', 'Menu Administracion Prestamos', this.trackingService.getEmail());
      return this.employeesxloansService.updateConcept(row.id, this.cleanDataForServer(row));
    });
    try {
      await lastValueFrom(concat(...addObservables, ...updateObservables).pipe(toArray()));
      alerts.userSaveSuccessToast('Abonos', 'Se han actualizado los datos correctamente.');
      this.detailNotSavedChanges = false;
      this.loadDetailedData();
      this.refreshMaster?.(this.idLoan);
    } catch (error) {
      if (error.status === 400) {
        alerts.userSaveErrorToast('Añadir entrada', error.error.message || 'Error al actualizar los datos.');
      } else {
        alerts.userSaveErrorToast('Error', 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.');
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
        alerts.userSaveErrorToast('Eliminar entrada', 'Error al eliminar la entrada.');
        console.error(error);
        return EMPTY;
      }))
      .subscribe(() => {
        alerts.userDeleteSuccessToast('Eliminar entrada', 'Entrada eliminada satisfactoriamente.');
        this.detailNotSavedChanges = false;
        this.loadDetailedData();
        this.refreshMaster?.(this.idLoan);
        this.trackingService.addLog(this.trackingService.getnameComp(), 'Delete Detalle Registro en Prestamos', 'Menu Administracion Prestamos', this.trackingService.getEmail());
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
