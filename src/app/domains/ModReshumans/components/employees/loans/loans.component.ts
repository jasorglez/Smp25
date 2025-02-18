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
  idLoan: number = null;
  nameLoan: string = null;
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

  public maestroGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onMaestroRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onMaestroRowSelected: (event) => {
      // Deseleccionar otras filas cuando se selecciona una nueva
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    }
  };

  public detalleGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onDetalleRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onDetalleRowSelected: (event) => {
      // Deseleccionar otras filas cuando se selecciona una nueva
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    }
  };

  loadData() {
    if (this.idEmployee === null || this.idEmployee === undefined) {
      return;
    }
    console.log("Loading data for employee ID:", this.idEmployee);

    this.employeesxloansService.getLoansByEmployee(this.idEmployee, 'PRESTAMO').subscribe(
      (maestroRowData: any[]) => {
        if (!maestroRowData || maestroRowData.length === 0) {
          alerts.basicAlert('Aviso', 'No hay datos disponibles', 'info');
          this.maestroRowData = this.detalleRowData = [];
        } else {
          console.log("Loans data:", maestroRowData);
          this.maestroRowData = maestroRowData;
        }
      },
      (error) => {
        console.error("Error loading loans data:", error);
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
      }
    );
  }

  loadDetailedData() {
    if(this.idLoan === null || this.idLoan === undefined) {
      return;
    }

    this.employeesxloansService.getConceptsxLoansCredit(this.idLoan).subscribe(
      (detalleRowData) => {
        if (!detalleRowData || detalleRowData.length === 0) {
          alerts.basicAlert('Aviso', 'No hay datos disponibles', 'info');
          this.detalleRowData = [];
        } else {
          console.log("Loans data:", detalleRowData);
          this.detalleRowData = detalleRowData;
          console.log(this.detalleRowData)
        }
      },
      (error) => {
        console.error("Error loading detailed loan data:", error);
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
      }
    )
  }

  maestroColumnDefs: ColDef[] = [
    { headerName: 'Prestamo', field: 'name',
      flex: 2 },
    { 
      headerName: 'Fecha', 
      field: 'date',
      valueFormatter: (params) => {
        if (params.value) {
          const date = new Date(params.value);
          return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
        }
        return '';
      },
      flex: 1
    },
    { 
      headerName: 'Total', 
      field: 'monto',
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
          }).format(params.value);
        }
        return '';
      },
      flex: 1
    },
  ];

  detalleColumnDefs: ColDef[] = [
    { headerName: 'Fecha', field: 'date',
      valueFormatter: (params) => {
        if (params.value) {
          const date = new Date(params.value);
          return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
        }
        return '';
      },
      flex: 1
     },
    { headerName: 'Abono', field: 'total', valueFormatter: (params) => {
      if (params.value) {
        return new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN'
        }).format(params.value);
      }
      return '';
    },
    flex: 1 },
    { headerName: 'Comentario', field: 'descripcion', flex: 2 },
  ];

  private maestroGridApi: any;
  private detalleGridApi: any;

  addRow(type: string) {
    if (type === 'maestro') {
      const newRow = { id: this.maestroRowData.length + 1, nombre: `Nombre ${this.maestroRowData.length + 1}` };
      this.maestroRowData = [...this.maestroRowData, newRow];
    }
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
      this.idLoan = selectedMaestro.id;
      this.nameLoan = selectedMaestro.name;
      this.loadDetailedData();
    } else {
      this.detalleRowData = [];
    }
  }


  saveMasterChanges() {}

  revertMasterData() {
    this.loadData();
    this.masterNotSavedChanges = false;
  }

  deleteMasterEntry() {}

  addDetailRow() {}

  saveDetailChanges() {}

  revertDetailData() {
    this.loadDetailedData();
    this.detailNotSavedChanges = false;
  }

  deleteDetailEntry() {}

  onMasterCellValueChanged(event: any): void {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.masterNotSavedChanges = true;
  }

  onDetailCellValueChanged($event) {
    console.log('Dato cambiado:', $event.data);
    $event.data.__modified = true;
    this.detailNotSavedChanges = true;
  }
}