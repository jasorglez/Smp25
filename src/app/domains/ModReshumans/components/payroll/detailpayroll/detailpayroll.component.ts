import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import * as bootstrap from 'bootstrap';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
  CellDoubleClickedEvent
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { PayrollService } from 'app/services/payroll.service';
import { SignalsService } from 'app/services/signals.service';
import { concat, lastValueFrom, timeInterval, toArray } from 'rxjs';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { EmployeesxSavingsComponent } from "../../employees/savings/savings.component";
import { BonusComponent } from '../bonus/bonus.component';
import { ModalBonusComponent } from './modalBonus/modalBonus.component';
import { EmployeesService } from 'app/services/employees.service';
import { AdministrationService } from 'app/services/administration.service';

@Component({
  selector: 'app-detailpayroll',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ReactiveFormsModule, EmployeesxSavingsComponent, ModalBonusComponent],
  templateUrl: './detailpayroll.component.html',
  styleUrls: ['./detailpayroll.component.css']
})

export class DetailpayrollComponent implements OnInit{
  private employeeService = inject(EmployeesService);
  private administrationService = inject(AdministrationService);
  private signalsService = inject(SignalsService);
  private payrollService = inject(PayrollService);

  defaultColDef = {
    sortable: true
  };

  public gridOptions: any = {
    headerHeight: 20,
    domLayout: 'normal',
    rowHeight: 20
  };
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  rowData: any[] = [];
  loanIds: number;
  gridApi: any;
  idLoan: number = null;
  nameLoan: string = null;
  id: number;
  closed: boolean = false;
  typeModal: string ='';
  masterNotSavedChanges: boolean = false;
  detailNotSavedChanges: boolean = false;
  selectedLoanId: any;
  masterNewlyAddedRows: string[] = [];
  detailedNewlyAddedRows: string[] = [];
  idPayroll: number;

  columnDefs: ColDef[] = [
    { headerName: 'Nombre Empleado', field: 'employeeName', width: 300, filter: true,  filterParams: {defaultToNothingSelected: true,},},
    {
      headerName: 'Precio x Hora',
      width: 150,
      field: 'priceXHour',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },
    {
      headerName: 'Horas Trabajadas',
      width: 150,
      field: 'workedHours',
      valueFormatter: (params) => {
        const value = params.value;
        if (typeof value !== 'number' || isNaN(value)) return '';
      
        const hours = Math.floor(value);
        const minutes = Math.round((value - hours) * 60);
      
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      },
    },
    { headerName: 'Horas Extra', width: 150, field: 'extraWorkedHours' },
    { headerName: 'Horas Extra Especiales', width: 150, field: 'extraWorkedHours' },
    {
      headerName: 'Faltas',
      width: 100,
      field: 'absences',
     /*  valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      } */
    },

    {
      headerName: 'Retardos',
      width: 110,
      field: 'delays',
     /*  valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      } */
    },
    {
      headerName: 'Salario Base',
      width: 150,
      field: 'baseSalary',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },
    {
      headerName: 'Salario Extra',
      width: 150,
      field: 'extraSalary',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },
    {
      headerName: 'Bonos',
      width: 100,
      field: 'bonus',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      },
      
    },
     {
      headerName: 'Sueldo Bruto',
      width: 150,
      field: 'grossSalary',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },

    {
      headerName: 'Descuento Real',
      width: 150,
      editable: this.signalsService.getClosedPayroll()(),
      field: 'realDiscount',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      },
    },
    /*{ headerName: 'Descuentos (%)', width: 150, field: 'percentageDiscount' },*/
    {
      headerName: 'Ahorros',
      width: 100,
      field: 'savings',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },

    {
      headerName: 'Bancos',
      width: 150,
      field: 'bancoNombre',
    },
    {
      headerName: 'Pago Digital',
      width: 150,
      field: 'digitalPayment',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    },



    {
      headerName: 'Total Efectivo',
      width: 150,
      field: 'total',
      valueFormatter: (params) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
      }
    }
  ];

  constructor(private fb: FormBuilder) {
    effect(() => {
      this.idPayroll = this.signalsService.getNormalPayrollId()();
      if (this.signalsService.getRefreshNomina() == true) {
        this.loadData(); // Actualizar datos cuando se recibe señal
        this.signalsService.resetRefreshNomina(); // Resetear la señal después de actualizar
      }
      this.loadData();
      console.log("------------------------------------ Constructor ID PAYROLL: ", this.idPayroll);
      console.log("-------- entrando a detailpayroll, este es el constructor  ")

    }, { allowSignalWrites: true });

  }

  ngOnInit() {
      this.idPayroll = this.signalsService.getIdEmployee()();
      this.loadData();
      console.log("------------------------------------ ngOninit ID PAYROLL: ", this.idPayroll);
      console.log("-------- entrando a detailpayroll, este es el ngOninit  ");

  }
 onCellValueChanged(event: any): void {
  const selectedRowData = event.data;
  const newValueOriginal = event.newValue;
  const id = selectedRowData.id;
  const idEmployee = selectedRowData.id_employee;

  this.employeeService.getEmployeeById(idEmployee).subscribe(
    (data: any) => {
      const loan = data?.[0]?.loan;

      if (loan === undefined) {
        alerts.basicAlert(
          'Información no disponible',
          'No se encontró información sobre el préstamo del empleado.',
          'warning'
        );
        this.administrationService.updateRealDiscountNormalPayroll(id, 0).subscribe(() => {
          this.loadData();
          this.signalsService.triggerRefreshNomina();
        });
        return;
      }

      let newValue = newValueOriginal;

      if (newValue > loan) {
        newValue = loan;
        setTimeout(() => {
         alerts.basicAlert(
            'Descuento real actualizado',
            `El monto es mayor al préstamo del empleado, se ha ajustado a $${newValue}.`,
            'success'
          );
        }, 300);
      }

      this.administrationService.updateRealDiscountNormalPayroll(id, newValue).subscribe(
        (res) => {
          console.log('Descuento real actualizado correctamente:', res);
          alerts.basicAlert(
            'Actualización exitosa',
            'El descuento real se ha actualizado correctamente.',
            'success'
          );
          this.loadData();
          this.signalsService.triggerRefreshNomina();
        },
        (error) => {
          console.error('Error al actualizar el descuento real:', error);
          alerts.basicAlert(
            'Error',
            error?.error?.message || 'No se pudo actualizar el descuento real.',
            'error'
          );
          this.loadData();
          this.signalsService.triggerRefreshNomina();
        }
      );
    },
    (error) => {
      console.error('Error al obtener datos del empleado:', error);
      alerts.basicAlert(
        'Error',
        'No se pudieron obtener los datos del empleado.',
        'error'
      );
    }
  );
}
  /*@HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent) {
    if (this.masterNotSavedChanges || this.detailNotSavedChanges) {
      const confirmationMessage = 'Tienes cambios sin guardar. ¿Estás seguro de que deseas salir?';
      event.returnValue = confirmationMessage; // Mostrar mensaje de confirmación
      return confirmationMessage;
    }
  }*/

  refreshGrid() {
    this.signalsService.triggerRefreshNomina();
    this.signalsService.resetInitSaving();
  }

  loadData() {
    if (this.idPayroll === null || this.idPayroll === undefined) {
      return;
    }

    this.payrollService.getDetailsForNormalPayrolls(this.idPayroll).subscribe(
      (data: any) => {
        this.rowData = data;
        console.log("------------------------------------ DETAILPAYROLLSERVICE: ", this.rowData);
        if (this.gridApi) {
          //this.gridApi.sizeColumnsToFit(); // Ajustar columnas al tamaño del contenedor
          // O también puedes usar:
          //this.gridApi.autoSizeAllColumns();
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
  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
     const colId = event.column.getColId();
     if(this.signalsService.getClosedPayroll()()){
      if(colId =="savings" ){//
        this.typeModal = colId;
        const selectedRowData = event.data; 
        this.signalsService.setIdEmployeePayroll(selectedRowData.id);
        this.signalsService.setIdEmployee(selectedRowData.id_employee);
        this.signalsService.setInitSaving();
        const modal = new bootstrap.Modal(document.getElementById('savings')!);
        modal.show();
    }
    if( colId == "bonus"){//
        this.typeModal = colId;
        const selectedRowData = event.data; 
        this.signalsService.setIdEmployee(selectedRowData.id_employee);
        const modal = new bootstrap.Modal(document.getElementById('bonus')!);
        modal.show();
    }

     }
    
  }


  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    //this.gridApi.sizeColumnsToFit(); // Ajustar columnas al tamaño del contenedor
  }

}


