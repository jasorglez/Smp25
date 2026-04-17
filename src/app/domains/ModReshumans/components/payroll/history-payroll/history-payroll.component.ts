import { Component, effect, inject, signal } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { GridApi } from 'ag-grid-enterprise';
import { HistoryPayrollService } from 'app/services/history-payroll.service';
import {
  HistoryPayrollResponse,
  PayrollEmployee,
} from '../../../../../interface/history-payroll.interface';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { BranchsService } from 'app/services/branchs.service';

import { DomainsModule } from 'app/domains/domainsmodule';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShowEmployeesTableComponent } from './employees-table/employees-table.component';
import { DigitalPayrollDetailsTableComponent } from './digital-payroll-details-table/digital-payroll-details-table.component';

@Component({
  selector: 'app-history-payroll',
  standalone: true,
  imports: [
    AgGridModule,
    RouterModule,
    DomainsModule,
    FormsModule,
    ShowEmployeesTableComponent,
    DigitalPayrollDetailsTableComponent,
  ],
  templateUrl: './history-payroll.component.html',
})
export class HistoryPayrollComponent {
  //MIO
  private historyPayrollService = inject(HistoryPayrollService);

  //

  private signalsService = inject(SignalsService);

  private branchesService = inject(BranchsService);

  private idBranch: number = 0;

  private idRoot: number = 0;

  public gridHeight = signal('80vh');

  public showPayrollDetailTab = signal(false);

  public rowData: HistoryPayrollResponse[] = [];

  public employeeData = signal<PayrollEmployee[]>([]);

  public components: { [p: string]: any };

  public idEmployee = signal<number | null>(null);

  public showLoansTab: any;

  // Referencia al grid API
  private gridApi: GridApi;

  private branchs = signal([]);

  private aggregatingRecord = signal(false);

  public notSavedChanges = signal(false);

  // Datos para la tabla
  // Estado de carga
  public isLoading = signal(false);

  public rowSelection: 'single' | 'multiple' = 'single';

  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.rowData = [];

      this.obtenerDatos();
      this.obtenerBranchs();
    });
  }

  setShowPayrollDetails(event: boolean) {
    this.showPayrollDetailTab.set(event);
    this.adjustGridSize();
  }

  setEmployeeData(employeeData) {
    this.employeeData.set(employeeData);
  }

  // MIO
   obtenerDatos() {
      this.historyPayrollService.getHistoryPayrollsByBranch(this.idBranch).subscribe(
        (data) => {
          this.rowData = Array.isArray(data) ? data : [data];
          this.isLoading.set(false);
        },
        (error) => {
          this.rowData = [];
        }
      );
    }


 

  adjustGridSize() {
    this.gridHeight.set('20vh'); // Adjust as needed
  }

  resetGridSize() {
    this.gridHeight.set('80vh'); // Reset to default height
    this.showPayrollDetailTab.set(false); // Ocultar la pestaña de detalle
    if (this.gridApi) {
      this.gridApi.setFilterModel(null); // Limpiar filtros
      this.gridApi.onFilterChanged(); // Aplicar cambios
    }
  }

  // Método para refrescar los datos
  refreshData(): void {
    this.aggregatingRecord.set(false);
    this.obtenerDatos();
    this.resetGridSize();
  }

  // ESTA SI ME SIRVE
  deleteEntry() {
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
    alerts
      .confirmAlert(
        'Eliminar nómina',
        '¿Está seguro que desea eliminar esta nómina?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          // this.payrollService.deletePayroll(id).pipe(
          //     catchError((error) => {
          //       alerts.basicAlert(
          //         'Eliminar nómina',
          //         'Error al eliminar la nómina.',
          //         'error'
          //       );
          //       console.error(error);
          //       return EMPTY;
          //     })
          //   )
          //   .subscribe(() => {
          //     alerts.basicAlert(
          //       'Nómina eliminada',
          //       'La nómina se eliminó correctamente',
          //       'success'
          //     );
          //     this.loadPayrollHistory();
          //     this.notSavedChanges.set(false);
          //     this.selectedRowData.set(null);
          //   });
        }
      });
  }

  obtenerBranchs() {
    this.branchesService.getBrancheswoa(this.idRoot).subscribe(
      (data: any) => {
        this.branchs.set(data);
        // console.log('this.branchs ', this.branchs);
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
}
