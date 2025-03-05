import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { PayrollService, PayrollData, EmployeePayroll } from '../../../../services/payroll.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [
    CommonModule,
    AgGridModule,
    FormsModule],
  templateUrl: './payroll.component.html',
  styleUrl: './payroll.component.scss'
})

export class PayrollComponent implements OnInit {
  // Datos para la tabla
  rowData: EmployeePayroll[] = [];
  
  // Estado de carga
  isLoading = false;
  
  // Referencia al grid API
  private gridApi: any;
  
  // Definición de columnas para AG Grid
  columnDefs: ColDef[] = [
    { field: 'nombre', headerName: 'Nombre', sortable: true, filter: true, resizable: true },
    { field: 'diasTrabajados', headerName: 'Días', sortable: true, filter: true, width: 90 },
    { field: 'salarioDiario', headerName: 'Sal. Diario', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'salarioDiarioIntegrado', headerName: 'SDI', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'sueldos', headerName: 'Sueldos', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'totalPercepciones', headerName: 'Tot. Percepciones', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'percepcionesGravadas', headerName: 'Perc. Gravadas', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'impuestoArt96', headerName: 'Imp. Art.96', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'ISPT', headerName: 'ISPT', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'IMSS', headerName: 'IMSS', sortable: true, filter: true, valueFormatter: this.currencyFormatter },
    { field: 'neto', headerName: 'Neto', sortable: true, filter: true, valueFormatter: this.currencyFormatter }
  ];
  
  // Configuración por defecto para todas las columnas
  defaultColDef: ColDef = {
    flex: 1,
    minWidth: 100,
    resizable: true,
    sortable: true,
    filter: true
  };
  
  constructor(private payrollService: PayrollService) {}
  
  ngOnInit(): void {
    this.loadData();
  }
  
  // Formateo de valores monetarios
  currencyFormatter(params: any) {
    if (typeof params.value !== 'number') {
      return params.value;
    }
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(params.value);
  }
  
  // Carga los datos desde el API
  loadData(): void {
    this.isLoading = true;
    
    this.payrollService.getPayrolls().subscribe({
      next: (data) => {
        // Procesar los datos para obtener todos los empleados de todas las nóminas
        let allEmployees: EmployeePayroll[] = [];
        
        data.forEach(payroll => {
          if (payroll.empleados && Array.isArray(payroll.empleados)) {
            // Añadir información de la nómina a cada empleado
            const employeesWithPayrollInfo = payroll.empleados.map(emp => ({
              ...emp,
              empresa: payroll.empresa,
              periodo: payroll.periodo,
              ejercicio: payroll.ejercicio
            }));
            
            allEmployees = [...allEmployees, ...employeesWithPayrollInfo];
          }
        });
        
        this.rowData = allEmployees;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al obtener datos de nóminas:', error);
        this.isLoading = false;
        // Aquí podrías mostrar un mensaje de error
      }
    });
  }
  
  // Evento cuando el grid está listo
  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    // Ajustar columnas al tamaño óptimo
    this.gridApi.sizeColumnsToFit();
  }
  
  // Método para exportar a Excel
  exportToExcel(): void {
    if (this.gridApi) {
      this.gridApi.exportDataAsExcel({
        fileName: `Nominas_${new Date().toISOString().split('T')[0]}.xlsx`
      });
    }
  }
  
  // Método para refrescar los datos
  refreshData(): void {
    this.loadData();
  }
}

