import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams, SelectionChangedEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { ModalService } from 'app/services/modal.service';
import { SignalsService } from 'app/services/signals.service';

import { concat, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-employeesxloans',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './loans.component.html',
  styleUrl: './loans.component.scss'
})
export class EmployeesxLoansComponent {
  
  private employeesxloansService = inject(EmployeesxloansService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);

  defaultColDef = {
    flex: 1,
    resizable: true,
    sortable: true,
    filter: true,
    editable: true
  };

  rowData: any[] = [];
  maestroRowData: any[] = [];
  detalleRowData: any[] = [];
  loanIds: number;

  gridApi: any;

  idEmployee: number;

  id: number;

  masterNotSavedChanges: boolean = false;
  detailNotSavedChanges: boolean = false;
  selectedLoanId: any;

  
  ngOnInit() {
    
  }

  constructor() {
     effect(() => {
       this.idEmployee = this.signalsService.getIdEmployee()();
       this.loadData();
      }
    );
  }

  loadData() {
    if (this.idEmployee === null || this.idEmployee === undefined) {
      return; // Or handle the case where the ID is not yet available.
    }
    console.log("Loading data for employee ID:", this.idEmployee); // Use console.log for debugging

    this.employeesxloansService.getLoansByEmployee(this.idEmployee, 'PRESTAMO').subscribe(
      (maestroRowData: any[]) => {
        if (!maestroRowData || maestroRowData.length === 0) {
          alerts.basicAlert('Aviso', 'No hay datos disponibles', 'info');
        } else {
          // Process the data here
          console.log("Loans data:", maestroRowData); // Log the data to the console
        }
      },
      (error) => {
        console.error("Error loading loans data:", error); // Handle errors
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error'); // Show an error message to the user
      }
    );
  }
  

  // Datos y columnas para el grid maestro
  
  maestroColumnDefs: ColDef[] = [
    
    { headerName: 'Prestamo', field: 'nombre' },
    { headerName: 'Fecha', field: 'date' },
    { headerName: 'Total', field: 'monto' },
    // Agrega más columnas según sea necesario
  ];

  // Datos y columnas para el grid detalle

  detalleColumnDefs: ColDef[] = [    
    { headerName: 'Fecha', field: 'date' },
    { headerName: 'Abono', field: 'total' },
    { headerName: 'Comentario', field: 'descripcion' },
    // Agrega más columnas según sea necesario
  ];

  // Referencias a los grids
  private maestroGridApi: any;
  private detalleGridApi: any;

  // Método para agregar una fila al grid maestro
  addRow(type: string) {
    if (type === 'maestro') {
      const newRow = { id: this.maestroRowData.length + 1, nombre: `Nombre ${this.maestroRowData.length + 1}` };
      this.maestroRowData = [...this.maestroRowData, newRow];
    }
  }

  // Método cuando el grid maestro está listo
  onMaestroGridReady(params: GridReadyEvent) {
    this.maestroGridApi = params.api;
  }

  // Método cuando el grid detalle está listo
  onDetalleGridReady(params: GridReadyEvent) {
    this.detalleGridApi = params.api;
  }

  // Método cuando se selecciona una fila en el grid maestro
  onMaestroSelectionChanged(event: SelectionChangedEvent) {
    const selectedRows = this.maestroGridApi.getSelectedRows();
    if (selectedRows.length > 0) {
      const selectedMaestro = selectedRows[0];
      // Simula la carga de detalles basado en la selección del maestro
      this.detalleRowData = this.getDetalleData(selectedMaestro.id);
    } else {
      this.detalleRowData = [];
    }
  }

  // Método para obtener los detalles basados en el ID del maestro
  getDetalleData(maestroId: number): any[] {
    // Simula datos de detalle
    return [
      { detalleId: 1, descripcion: `Detalle 1 para Maestro ${maestroId}` },
      { detalleId: 2, descripcion: `Detalle 2 para Maestro ${maestroId}` },
      // Agrega más detalles según sea necesario
    ];
  }

  saveMasterChanges() {

  }

  revertMasterData() {

  } 

  deleteMasterEntry() {

  }

  addDetailRow() {

  } 

  saveDetailChanges() {

  } 

  revertDetailData() {

  } 
  
  deleteDetailEntry() {

  } 

  // Add this method to the class
  onMasterCellValueChanged(event: any): void {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.masterNotSavedChanges = true
  }

  onDetailCellValueChanged($event) {
    console.log('Dato cambiado:', $event.data);
    $event.data.__modified = true;
    this.detailNotSavedChanges
  } 

}
