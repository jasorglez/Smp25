import { Component, effect, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { SignalsService } from 'app/services/signals.service';
import { ClockService } from 'app/services/clock.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { alerts } from '../../../../../helpers/alerts';

@Component({
  selector: 'app-special-extra-hours-master',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule],
  templateUrl: './special-extra-hours-master.component.html',
  styleUrl: './special-extra-hours-master.component.scss'
})
export default class SpecialExtraHoursMasterComponent {
  private signalsService = inject(SignalsService);
  private clockService = inject(ClockService);
  private fb = inject(FormBuilder);

  idBranch: number = 0;
  rowData: any[] = [];
  gridHeight: string = '75vh';
  private gridApi: GridApi;

  selectFechas: FormGroup;

  constructor() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.selectFechas = this.fb.group({
      fechaInicio: [firstDay.toISOString().split('T')[0], Validators.required],
      fechaFin:    [today.toISOString().split('T')[0],    Validators.required]
    });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.obtenerDatos();
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
      {
        field: 'idEmployee',
        headerName: 'ID',
        hide: true,
        width: 80
      },
      {
        field: 'name',
        headerName: 'Nombre',
        width: 200
      },
      {
        field: 'date',
        headerName: 'Fecha',
        width: 120,
        valueFormatter: (params) => {
          if (!params.value) return '';
          const [year, month, day] = params.value.split('-');
          return `${day}-${month}-${year}`;
        }
      },
      {
        field: 'inTime',
        headerName: 'Entrada',
        width: 100
      },
      {
        field: 'outTime',
        headerName: 'Salida',
        width: 100
      },
      {
        field: 'specialExtraHours',
        headerName: 'Horas Extra Especiales',
        width: 160
      },
      {
        field: 'specialExtraMinutes',
        headerName: 'Minutos',
        width: 100
      }
    ];
  }

  obtenerDatos() {
    if (!this.idBranch) return;
    const { fechaInicio, fechaFin } = this.selectFechas.value;
    if (!fechaInicio || !fechaFin) return;

    this.clockService.getSpecialExtraHoursByBranch(this.idBranch, fechaInicio, fechaFin).subscribe({
      next: (data: any[]) => {
        this.rowData = data;
        setTimeout(() => {
          if (this.gridApi) {
            const allColumnIds = this.gridApi.getColumns().map(col => col.getColId());
            this.gridApi.autoSizeColumns(allColumnIds);
          }
        }, 100);
      },
      error: () => {
        alerts.basicAlert('Error', 'Error al cargar las horas extra especiales', 'error');
      }
    });
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