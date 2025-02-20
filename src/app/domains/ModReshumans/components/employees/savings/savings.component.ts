import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  SelectionChangedEvent,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmployeesxloansService } from 'app/services/employeesxloans.service';
import { ModalService } from 'app/services/modal.service';
import { SignalsService } from 'app/services/signals.service';
import { concat, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-employeesxsavings',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './savings.component.html',
  styleUrl: './savings.component.scss',
})
export class EmployeesxSavingsComponent {
  private employeesxloansService = inject(EmployeesxloansService);
  private signalsService = inject(SignalsService);
  private modalServiceTable = inject(ModalService);

  defaultColDef = {
    flex: 1,
    resizable: true,
    sortable: true,
    filter: true,
    editable: (params) => {
      // Permitir edición solo si la fila es nueva
      return params.data?.__isNew === true;
    },
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
  private tempIdCounter: number = 0;
  masterNewlyAddedRows: string[] = [];
  detailedNewlyAddedRows: string[] = [];

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
    },
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
    },
  };

  loadData() {
    if (this.idEmployee === null || this.idEmployee === undefined) {
      return;
    }
    console.log('Loading data for employee ID:', this.idEmployee);

    this.employeesxloansService
      .getLoansByEmployee(this.idEmployee, 'AHORRO')
      .subscribe(
        (maestroRowData: any[]) => {
          if (!maestroRowData || maestroRowData.length === 0) {
            this.maestroRowData = this.detalleRowData = [];
          } else {
            console.log('Loans data:', maestroRowData);
            this.maestroRowData = maestroRowData;
          }
        },
        (error) => {
          console.error('Error loading loans data:', error);
        }
      );
  }

  loadDetailedData() {
    if (this.idLoan === null || this.idLoan === undefined) {
      return;
    }

    this.employeesxloansService.getConceptsxLoansCredit(this.idLoan).subscribe(
      (detalleRowData) => {
        if (!detalleRowData || detalleRowData.length === 0) {
          this.detalleRowData = [];
        } else {
          console.log('Loans data:', detalleRowData);
          this.detalleRowData = detalleRowData;
          console.log(this.detalleRowData);
        }
      },
      (error) => {
        console.error('Error loading detailed loan data:', error);
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
      }
    );
  }

  maestroColumnDefs: ColDef[] = [
    { 
      headerName: 'Ahorro *', 
      headerClass: 'required-header',
      field: 'name', 
      flex: 2,
      editable: (params) => params.data?.__isNew === true
    },
    {
      headerName: 'Fecha',
      field: 'date',
      valueFormatter: (params) => {
        if (params.value) {
          // Convertir a fecha local
          const date = new Date(params.value);
          const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
          return `${('0' + localDate.getDate()).slice(-2)}-${(
            '0' +
            (localDate.getMonth() + 1)
          ).slice(-2)}-${localDate.getFullYear()}`;
        }
        return '';
      },
      flex: 1,
      editable: (params) => params.data?.__isNew === true
    },
    {
      headerName: 'Total *',
      headerClass: 'required-header',
      field: 'monto',
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        }
        return '';
      },
      flex: 1,
      editable: (params) => params.data?.__isNew === true
    },
    {
      headerName: 'Retirado',
      field: 'payments',
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        }
        return '$0.00';
      },
      flex: 1,
      editable: false
    },
    {
      headerName: 'Restante',
      field: 'remain',
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        }
        return '$0.00';
      },
      flex: 1,
      editable: false
    },
  ];

  detalleColumnDefs: ColDef[] = [
    {
      headerName: 'Fecha',
      field: 'date',
      valueFormatter: (params) => {
        if (params.value) {
          // Convertir a fecha local
          const date = new Date(params.value);
          const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
          return `${('0' + localDate.getDate()).slice(-2)}-${(
            '0' +
            (localDate.getMonth() + 1)
          ).slice(-2)}-${localDate.getFullYear()}`;
        }
        return '';
      },
      flex: 1,
      editable: (params) => params.data?.__isNew === true
    },
    {
      headerName: 'Abono *',
      headerClass: 'required-header',
      field: 'total',
      valueFormatter: (params) => {
        if (params.value) {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value);
        }
        return '$0.00';
      },
      flex: 1,
      editable: (params) => params.data?.__isNew === true
    },
    { 
      headerName: 'Comentario', 
      field: 'descripcion', 
      flex: 2,
      editable: (params) => params.data?.__isNew === true
    },
  ];

  private maestroGridApi: any;
  private detalleGridApi: any;

  addRow(type: string) {
    const tempId = `temp_${this.tempIdCounter++}`;
    // Usar fecha local
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const formattedDate = `${('0' + localNow.getDate()).slice(-2)}-${(
      '0' +
      (localNow.getMonth() + 1)
    ).slice(-2)}-${localNow.getFullYear()}`;
    if (type === 'Master') {
      const newRow = {
        id: tempId,
        idEmpleado: this.idEmployee,
        name: `AHORRO ${formattedDate}`,
        date: localNow.toISOString(), // Usar fecha local en formato ISO
        type: 'AHORRO',
        monto: 0,
        payments: 0,
        __isNew: true,
        active: true
      };
      this.maestroRowData = [...this.maestroRowData, newRow];
      this.masterNotSavedChanges = true;
    } else if (type === 'Detailed') {
      const newRow = {
        id: tempId,
        idLoanAndCredit: this.idLoan,
        date: localNow.toISOString(), // Usar fecha local en formato ISO
        status: 'Pendiente',
        total: 0,
        comments: '',
        __isNew: true,
        active: true
      };
      this.detalleRowData = [...this.detalleRowData, newRow];
      this.detailNotSavedChanges = true;
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
      
      // Verificar si la fila maestra es nueva
      if (selectedMaestro?.__isNew === true) {
        this.detalleRowData = [];
        return;
      }
      
      this.idLoan = selectedMaestro.id;
      this.nameLoan = selectedMaestro.name;
      this.loadDetailedData();
    } else {
      this.detalleRowData = [];
    }
  }

  async saveMasterChanges() {
    const isValid = this.maestroRowData.every((item) => item.monto);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe ingresar un valor de préstamo.',
        'error'
      );
      return;
    }


    const newRows = this.maestroRowData.filter((row) => row.__isNew);
    const modifiedRows = this.maestroRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeesxloansService.addLoan(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeesxloansService.updateLoan(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.masterNotSavedChanges = false;
      this.masterNewlyAddedRows = [];
      await this.loadData(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  revertMasterData() {
    this.loadData();
    this.masterNotSavedChanges = false;
  }

  async saveDetailChanges() {
    const isValid = this.detalleRowData.every((item) => item.total);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe ingresar un valor de abono.',
        'error'
      );
      return;
    }


    const newRows = this.detalleRowData.filter((row) => row.__isNew);
    const modifiedRows = this.detalleRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeesxloansService.addConcept(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.employeesxloansService.updateConcept(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.masterNotSavedChanges = false;
      this.masterNewlyAddedRows = [];
      await this.loadData(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  revertDetailData() {
    this.loadDetailedData();
    this.detailNotSavedChanges = false;
  }

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

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }
}
