import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { TrackingService } from 'app/services/tracking.service';

import {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-saldos-palacio',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule,
    AgGridModule,
  ],
  templateUrl: './saldos-palacio.component.html',
  styleUrl: './saldos-palacio.component.scss',
})
export class SaldosPalacioComponent {
  authService = inject(AuthService);

  constructor() {
    this.obtenerDatos();
  }

  private trackingService = inject(TrackingService);
  private administrationService = inject(AdministrationService);

  saldoData: any[] = [];
  selectedRowData: any = null;
  private gridApi: GridApi;
  loading: boolean = false;

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    rowGroupPanelShow: 'never',
    suppressRowClickSelection: true,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'periodo',
        headerName: 'Periodo',
        filter: true,
        width: 150,
      },
      {
        field: 'ingresos',
        headerName: 'Ingresos',
        width: 150,
        valueFormatter: (params) => {
          if (params.value != null) {
            return `$${parseFloat(params.value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
          return '$0.00';
        },
        cellStyle: { color: '#198754', fontWeight: 'bold' },
      },
      {
        field: 'egresos',
        headerName: 'Egresos',
        width: 150,
        valueFormatter: (params) => {
          if (params.value != null) {
            return `$${parseFloat(params.value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
          return '$0.00';
        },
        cellStyle: { color: '#dc3545', fontWeight: 'bold' },
      },
      {
        field: 'saldo',
        headerName: 'Saldo',
        width: 150,
        valueFormatter: (params) => {
          if (params.value != null) {
            return `$${parseFloat(params.value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
          return '$0.00';
        },
        cellStyle: (params) => {
          if (params.value >= 0) {
            return { color: '#198754', fontWeight: 'bold' };
          } else {
            return { color: '#dc3545', fontWeight: 'bold' };
          }
        },
      },
      {
        field: 'fecha',
        headerName: 'Última Actualización',
        width: 180,
      },
    ];
  }

  obtenerDatos() {
    this.loading = true;
    // TODO: Cambiar por el endpoint correcto de saldos
    this.administrationService.getBanks().subscribe({
      next: (data: any) => {
        this.saldoData = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error fetching saldos:', error);
        this.loading = false;
        alerts.basicAlert(
          'Error',
          'No se pudieron cargar los saldos',
          'error'
        );
      },
    });
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Mostrar Listado de Saldos Palacio`,
      'Menu Administración - Palacio Municipal',
      this.trackingService.getEmail()
    );
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  refreshData() {
    this.obtenerDatos();
    alerts.basicAlert(
      'Datos actualizados',
      'Los saldos se han actualizado correctamente.',
      'success'
    );
  }

  exportToExcel() {
    if (this.gridApi) {
      this.gridApi.exportDataAsExcel({
        fileName: `saldos-palacio-${new Date().getTime()}.xlsx`,
        sheetName: 'Saldos'
      });
      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        `Exportar Saldos a Excel`,
        'Menu Administración - Palacio Municipal',
        this.trackingService.getEmail()
      );
    }
  }
}
