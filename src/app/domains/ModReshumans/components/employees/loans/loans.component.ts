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

  ngOnInit() {}

  constructor() {
    effect(() => {
      this.idEmployee = this.signalsService.getIdEmployee()();
      this.loadData();
    });
  }

  loadData() {
    if (this.idEmployee === null || this.idEmployee === undefined) {
      return;
    }
    console.log("Loading data for employee ID:", this.idEmployee);

    this.employeesxloansService.getLoansByEmployee(this.idEmployee, 'PRESTAMO').subscribe(
      (maestroRowData: any[]) => {
        if (!maestroRowData || maestroRowData.length === 0) {
          alerts.basicAlert('Aviso', 'No hay datos disponibles', 'info');
        } else {
          console.log("Loans data:", maestroRowData);
        }
      },
      (error) => {
        console.error("Error loading loans data:", error);
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
      }
    );
  }

  maestroColumnDefs: ColDef[] = [
    { headerName: 'Prestamo', field: 'nombre' },
    { headerName: 'Fecha', field: 'date' },
    { headerName: 'Total', field: 'monto' },
  ];

  detalleColumnDefs: ColDef[] = [
    { headerName: 'Fecha', field: 'date' },
    { headerName: 'Abono', field: 'total' },
    { headerName: 'Comentario', field: 'descripcion' },
  ];

  private maestroGridApi: any;
  private detalleGridApi: any;

  addRow(type: string) {
    if (type === 'maestro') {
      const newRow = { id: this.maestroRowData.length + 1, nombre: `Nombre ${this.maestroRowData.length + 1}` };
      this.maestroRowData = [...this.maestroRowData, newRow];
    }
  }

  saveChanges() {

  }

  revert(){

  }

  deleteEntry(){

  }


  onMaestroGridReady(params: GridReadyEvent) {
    this.maestroGridApi = params.api;
  }

  onDetalleGridReady(params: GridReadyEvent) {
    this.detalleGridApi = params.api;
  }

  onMaestroSelectionChanged(event: SelectionChangedEvent) {
    const selectedRows = this.maestroGridApi.getSelectedRows();
    if (selectedRows.length > 0) {
      const selectedMaestro = selectedRows[0];
      this.detalleRowData = this.getDetalleData(selectedMaestro.id);
    } else {
      this.detalleRowData = [];
    }
  }

  getDetalleData(maestroId: number): any[] {
    return [
      { detalleId: 1, descripcion: `Detalle 1 para Maestro ${maestroId}` },
      { detalleId: 2, descripcion: `Detalle 2 para Maestro ${maestroId}` },
    ];
  }

  saveMasterChanges() {}

  revertMasterData() {}

  deleteMasterEntry() {}

  addDetailRow() {}

  saveDetailChanges() {}

  revertDetailData() {}

  deleteDetailEntry() {}

  onMasterCellValueChanged(event: any): void {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.masterNotSavedChanges = true;
  }

  onDetailCellValueChanged($event) {
    console.log('Dato cambiado:', $event.data);
    $event.data.__modified = true;
    this.detailNotSavedChanges;
  }
}