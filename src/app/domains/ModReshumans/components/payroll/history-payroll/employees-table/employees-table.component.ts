import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ColDef, GridReadyEvent } from 'ag-grid-enterprise';

import { AgGridModule } from 'ag-grid-angular';
import { PayrollEmployee } from 'app/interface/history-payroll.interface';

@Component({
  selector: 'app-show-employees-table',
  standalone: true,
  imports: [AgGridModule],
  templateUrl: './employees-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowEmployeesTableComponent {
  defaultColDef = {
    sortable: true,
  };

  public gridOptions: any = {
    headerHeight: 20,
    domLayout: 'normal',
    rowHeight: 20,
  };

  rowDataResponse = input.required<PayrollEmployee[]>();
  loanIds: number;
  gridApi: any;
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
    {
      headerName: 'Nombre Empleado',
      field: 'name',
      width: 300,
      filter: true,
    },
    {
      headerName: 'Dias trabajados',
      width: 150,
      field: 'workedDays',
    },
    {
      headerName: 'Salario Diario integrado',
      width: 150,
      field: 'integratedDailySalary',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Salario Diario',
      width: 150,
      field: 'dailySalary',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Salarios',
      width: 150,
      field: 'wages',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Ganancias totales',
      width: 150,
      field: 'totalEarnings',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Otros ingresos',
      width: 150,
      field: 'otherEarnings',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Impuestos en ganancias',
      width: 150,
      field: 'taxableEarnings',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Impuestos del articulo 96',
      width: 150,
      field: 'article96Tax',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Subsidio del articulo 114',
      width: 150,
      field: 'article114Subsidy',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Subsidio total al empleo del artículo 115',
      width: 150,
      field: 'totalArticle115EmploymentSubsidy',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Subsidio de empleo acreditado',
      width: 150,
      field: 'accreditedEmploymentSubsidy',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Impuesto sobre la renta',
      width: 150,
      field: 'incomeTax',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Subsidio al empleo',
      width: 150,
      field: 'employmentSubsidy',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Seguro Médico',
      width: 150,
      field: 'medicalInsurance',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Seguro de jubilación',
      width: 150,
      field: 'retirementInsurance',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Seguridad Social',
      width: 150,
      field: 'socialSecurity',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Retención del Fondo de Vivienda',
      width: 150,
      field: 'housingFundWithholding',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Manutención',
      width: 150,
      field: 'childSupport',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
    {
      headerName: 'Pago neto',
      width: 150,
      field: 'netPay',
      valueFormatter: (params) => {
        return this.currencyFormatMx(params);
      },
    },
  ];

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    //this.gridApi.sizeColumnsToFit(); // Ajustar columnas al tamaño del contenedor
  }

  currencyFormatMx(params) {
    if (params.value) {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(params.value);
    }
    return '0.00';
  }
}
