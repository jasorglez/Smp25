import { Component, effect, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { SignalsService } from 'app/services/signals.service';
import { ClockService } from 'app/services/clock.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { alerts } from '../../../../../helpers/alerts';
import { concat, toArray } from 'rxjs';

@Component({
  selector: 'app-special-extra-hours-master',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule],
  templateUrl: './special-extra-hours-master.component.html',
  styleUrl: './special-extra-hours-master.component.scss'
})
export default class SpecialExtraHoursMasterComponent {
  private signalsService = inject(SignalsService);
  private clockService  = inject(ClockService);
  private fb            = inject(FormBuilder);

  idBranch: number = 0;
  idEmployee: number = 0;
  employeeStart: string = '';
  employeeEnd: string = '';
  mode: 'branch' | 'employee' = 'branch';

  rowData: any[] = [];
  gridHeight: string = '75vh';
  private gridApi: GridApi;
  notSavedChanges = false;

  selectFechas: FormGroup;

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  constructor() {
    const today    = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.selectFechas = this.fb.group({
      fechaInicio: [firstDay.toISOString().split('T')[0], Validators.required],
      fechaFin:    [today.toISOString().split('T')[0],    Validators.required]
    });

    effect(() => {
      const emp = this.signalsService.getDetailClockForEmployee();
      const empId = emp.idEmployee();
      if (empId) {
        this.mode = 'employee';
        this.idEmployee   = empId;
        this.employeeStart = emp.startDate();
        this.employeeEnd   = emp.endDate();
        this.obtenerDatos();
      }
    });

    effect(() => {
      const branchId = this.signalsService.getBranchSelectedBySidebar()();
      if (this.mode === 'branch') {
        this.idBranch = branchId;
        this.obtenerDatos();
      }
    });
  }

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
  };

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    onRowClicked: (event) => { event.node.setSelected(true); }
  };

  get colMaster(): ColDef[] {
    return [
      { field: 'outId',      headerName: 'ID OUT', hide: true },
      { field: 'idEmployee', headerName: 'ID Emp', hide: true },
      {
        field: 'name',
        headerName: 'Nombre',
        width: 200
      },
      {
        field: 'date',
        headerName: 'Fecha',
        width: 120,
        valueFormatter: (p) => {
          if (!p.value) return '';
          const [y, m, d] = p.value.split('-');
          return `${d}-${m}-${y}`;
        }
      },
      { field: 'inTime',             headerName: 'Entrada',  width: 90  },
      { field: 'outTime',            headerName: 'Salida',   width: 90  },
      { field: 'specialExtraHours',  headerName: 'Horas Extra Esp.', width: 130 },
      { field: 'specialExtraMinutes',headerName: 'Minutos',  width: 90  },
      {
        field: 'allowSpecialExtra',
        headerName: '¿Autorizado?',
        width: 140,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['true', 'false', ''] },
        valueFormatter: (p) => {
          if (p.value === true  || p.value === 'true')  return 'Sí — Cuenta';
          if (p.value === false || p.value === 'false') return 'No — No cuenta';
          return 'Pendiente';
        },
        valueParser: (p) => {
          if (p.newValue === 'true')  return true;
          if (p.newValue === 'false') return false;
          return null;
        },
        cellStyle: (p) => {
          if (p.value === true)  return { background: '#d4edda' };
          if (p.value === false) return { background: '#f8d7da' };
          return null;
        }
      },
      {
        field: 'specialExtraApprovedBy',
        headerName: 'Autorizado por',
        width: 160,
        editable: false
      }
    ];
  }

  obtenerDatos() {
    let request$;
    if (this.mode === 'employee') {
      if (!this.idEmployee || !this.employeeStart || !this.employeeEnd) return;
      request$ = this.clockService.getSpecialExtraHoursByEmployee(this.idEmployee, this.employeeStart, this.employeeEnd);
    } else {
      if (!this.idBranch) return;
      const { fechaInicio, fechaFin } = this.selectFechas.value;
      if (!fechaInicio || !fechaFin) return;
      request$ = this.clockService.getSpecialExtraHoursByBranch(this.idBranch, fechaInicio, fechaFin);
    }

    request$.subscribe({
      next: (data: any[]) => {
        this.rowData = data;
        this.notSavedChanges = false;
        setTimeout(() => {
          if (this.gridApi) {
            const cols = this.gridApi.getColumns().map(c => c.getColId());
            this.gridApi.autoSizeColumns(cols);
          }
        }, 100);
      },
      error: () => alerts.basicAlert('Error', 'Error al cargar horas extra especiales', 'error')
    });
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    event.data.specialExtraApprovedBy = this.signalsService.getDisplayName()();
    this.notSavedChanges = true;
    event.api.refreshCells({ rowNodes: [event.node], force: true });
  }

  saveChanges() {
    const modified = this.rowData.filter(r => r.__modified);
    if (!modified.length) {
      alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
      return;
    }

    const updates = modified.map(row =>
      this.clockService.updateSpecialExtraHours(row.outId, {
        allowSpecialExtra:      row.allowSpecialExtra,
        specialExtraApprovedBy: row.specialExtraApprovedBy
      })
    );

    concat(...updates).pipe(toArray()).subscribe({
      next: () => {
        alerts.basicAlert('Éxito', 'Cambios guardados correctamente', 'success');
        this.obtenerDatos();
      },
      error: () => alerts.basicAlert('Error', 'Error al guardar los cambios', 'error')
    });
  }

  revert() {
    this.obtenerDatos();
  }

  consultar() {
    if (this.selectFechas.valid) {
      this.obtenerDatos();
    } else {
      alerts.basicAlert('Error', 'Por favor selecciona ambas fechas', 'error');
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }
}