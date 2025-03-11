import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { PayrollService } from 'app/services/payroll.service';
import { SignalsService } from 'app/services/signals.service';
import { concat, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-detailpayroll',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './detailpayroll.component.html',
  styleUrls: ['./detailpayroll.component.css']
})

export class DetailpayrollComponent {
  private signalsService = inject(SignalsService);
  private payrollService = inject(PayrollService);

  defaultColDef = {
    sortable: true
  };

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30
  };

  rowData: any[] = [];
  loanIds: number;
  gridApi: any;
  idEmployee: number;
  idLoan: number = null;
  nameLoan: string = null;
  id: number;
  masterNotSavedChanges: boolean = false;
  detailNotSavedChanges: boolean = false;
  selectedLoanId: any;
  masterNewlyAddedRows: string[] = [];
  detailedNewlyAddedRows: string[] = [];
  idPayroll: number;

  columnDefs: ColDef[] = [
    { headerName: 'Nombre Empleado', field: 'employeeName', width: 800, filter: true },
    {
      headerName: 'Precio por Hora',
      width: 400,
      field: 'priceXHour',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },
    { headerName: 'Horas Trabajadas', width: 400, field: 'workedHours' },
    { headerName: 'Horas Extra', width: 400, field: 'extraWorkedHours' },
    {
      headerName: 'Salario Base',
      width: 400,
      field: 'baseSalary',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },
    {
      headerName: 'Salario Extra',
      width: 400,
      field: 'extraSalary',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },
    {
      headerName: 'Bonos',
      width: 400,
      field: 'bonus',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },
    { headerName: 'Descuentos (%)', width: 400, field: 'percentageDiscount' },
    {
      headerName: 'Descuento Real',
      width: 400,
      field: 'realDiscount',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },
    {
      headerName: 'Pago Digital',
      width: 400,
      field: 'digitalPayment',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },
    {
      headerName: 'Ahorros',
      width: 400,
      field: 'savings',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },
    {
      headerName: 'Total',
      width: 400,
      field: 'total',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    }
  ];

  constructor() {
    effect(() => {
      this.idPayroll = this.signalsService.getNormalPayrollId()();
      this.loadData();
    });
  }

  ngOnInit() {
    this.idPayroll = this.signalsService.getIdEmployee()();
    this.loadData();
  }

  loadData() {
    if (this.idPayroll === null || this.idPayroll === undefined) {
      return;
    }

    this.payrollService.getDetailsForNormalPayrolls(this.idPayroll).subscribe(
      (data: any) => {
        this.rowData = data;
        console.log(this.rowData);
        if (this.gridApi) {
          //this.gridApi.sizeColumnsToFit(); // Ajustar columnas al tamaño del contenedor
          // O también puedes usar:
          this.gridApi.autoSizeAllColumns();
        }
      },
      (error) => {
        this.rowData = [];
        console.error('Error loading payroll data:', error);
      }
    )
    /*
    this.employeesxloansService
      .getLoansByEmployee(this.idEmployee, 'PRESTAMO')
      .subscribe(
        (maestroRowData: any[]) => {
          if (!maestroRowData || maestroRowData.length === 0) {
            this.maestroRowData = this.detalleRowData = [];
          } else {
            this.maestroRowData = maestroRowData;
          }
        },
        (error) => {
          console.error('Error loading loans data:', error);
        }
      );
      */
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit(); // Ajustar columnas al tamaño del contenedor
  }

}


