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
    this.obtenerBanks();
  }

  private trackingService = inject(TrackingService);
  private administrationService = inject(AdministrationService);

  saldoData: any[] = [];
  rowDetails: any[] = [];
  selectedRowData: any = null;
  private gridApi: GridApi;
  private detailsGridApi: GridApi;
  loading: boolean = false;
  private lastSelectedId: string | null = null;
  banks: any;

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
        field: 'idBanco',
        headerName: 'Banco',
        editable: false,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.banks ? this.banks.map((item) => item.id) : [],
        },
        valueFormatter: (params) => {
          const foundItem = this.banks
            ? this.banks.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.name}` : params.value;
        },
      },
      {
        field: 'numberAccount',
        headerName: 'Numero Cuenta',
        editable: false,
        filter: true,
        width: 200,
      },
      {
        field: 'nameAccount',
        headerName: 'Nombre Cuenta',
        editable: false,
        width: 200,
        filter: true,
      },
      {
        field: 'interbancaria',
        headerName: 'Interbancaria',
        editable: false,
        width: 160,
      },
      {
        field: 'folioCheque',
        headerName: 'Inicio Cheque',
        editable: false,
        width: 129,
      },
      {
        field: 'folioSinCheque',
        headerName: 'Termino Cheque',
        editable: false,
        width: 140,
      },
      {
        field: 'gasto',
        headerName: 'Gastos',
        editable: false,
        width: 105,
        valueFormatter: (params) =>
          params.value?.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }),
      },
      {
        field: 'depositoPagado',
        headerName: 'Ingresos',
        editable: false,
        width: 105,
        valueFormatter: (params) =>
          params.value?.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }),
      },
      {
        field: 'saldo',
        headerName: 'Saldo',
        editable: false,
        width: 110,
        valueFormatter: (params) =>
          params.value?.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }),
      },
    ];
  }

  get colDetails(): ColDef[] {
    return [
      {
        field: 'numeroDocumento',
        headerName: 'Numero Documento',
        filter: true,
        width: 200,
        cellStyle: (params) => {
          const deposito = typeof params.data.deposito === 'string'
            ? parseFloat(params.data.deposito.replace(/,/g, ''))
            : params.data.deposito || 0;
          const gasto = typeof params.data.gasto === 'string'
            ? parseFloat(params.data.gasto.replace(/,/g, ''))
            : params.data.gasto || 0;
          return {
            backgroundColor: deposito > 0 ? '#e6ffe6' : gasto > 0 ? '#ffe6e6' : null,
          };
        },
      },
      {
        field: 'fecha',
        headerName: 'Fecha',
        width: 150,
        filter: true,
      },
      {
        field: 'descripcion',
        headerName: 'Descripción',
        width: 300,
      },
      {
        field: 'tipo',
        headerName: 'Tipo',
        width: 150,
      },
      {
        field: 'deposito',
        headerName: 'Ingreso',
        width: 150,
        valueFormatter: (params) => {
          const value = params.value || 0;
          return `$${value.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        },
        cellStyle: (params) => {
          const value = typeof params.value === 'string'
            ? parseFloat(params.value.replace(/,/g, ''))
            : params.value || 0;
          return {
            color: value > 0 ? '#198754' : null,
            backgroundColor: value > 0 ? '#e6ffe6' : null,
            fontWeight: value > 0 ? 'bold' : 'normal',
          };
        },
      },
      {
        field: 'gasto',
        headerName: 'Egreso',
        width: 150,
        valueFormatter: (params) => {
          const value = params.value || 0;
          return `$${value.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        },
        cellStyle: (params) => {
          const value = typeof params.value === 'string'
            ? parseFloat(params.value.replace(/,/g, ''))
            : params.value || 0;
          return {
            color: value > 0 ? '#dc3545' : null,
            backgroundColor: value > 0 ? '#ffe6e6' : null,
            fontWeight: value > 0 ? 'bold' : 'normal',
          };
        },
      },
      {
        field: 'saldo',
        headerName: 'Saldo',
        width: 150,
        valueFormatter: (params) => {
          const value = params.value || 0;
          return `$${value.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        },
        cellStyle: (params) => {
          if (params.value >= 0) {
            return { color: '#198754', fontWeight: 'bold' };
          } else {
            return { color: '#dc3545', fontWeight: 'bold' };
          }
        },
      },
    ];
  }

  obtenerBanks() {
    this.administrationService.get2fieldsBanks().subscribe({
      next: (data: any) => {
        this.banks = data;
      },
      error: (error) => {
        console.error('Error al cargar bancos:', error);
        this.banks = [];
        alerts.basicAlert('Error', 'Error al cargar el catálogo de bancos', 'error');
      }
    });
  }

  obtenerDatos() {
    this.loading = true;

    const companyId = parseInt(localStorage.getItem('company') || '0');
    if (!companyId) {
      console.error('No hay empresa seleccionada en localStorage');
      this.loading = false;
      return;
    }

    this.administrationService
      .getAccountBanks(companyId)
      .subscribe({
        next: (response: any) => {
          if (response && response.length > 0) {
            this.saldoData = response;
          } else {
            this.saldoData = [];
          }
        },
        error: (error) => {
          // 404 significa "no hay datos", no es un error real
          if (error.status === 404) {
            this.saldoData = [];
            console.log('No hay cuentas bancarias para esta empresa');
          } else {
            // Otros errores sí son problemas reales
            console.error('Error al cargar cuentas bancarias:', error);
            this.saldoData = [];
            alerts.basicAlert('Error', 'Error al cargar las cuentas bancarias', 'error');
          }
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
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
      const selectedData = selectedNodes[0].data;
      this.selectedRowData = selectedData;

      // Solo cargar balance si el ID no es temporal (nueva fila)
      if (selectedData.id && !selectedData.id.toString().startsWith('temp_')) {
        this.loadBalanceData(selectedData.id);
      } else {
        // Limpiar detalles para filas nuevas
        this.rowDetails = [];
      }
    } else {
      this.selectedRowData = null;
      this.rowDetails = [];
    }
  }

  private loadBalanceData(id: string) {
    if (!id || id === this.lastSelectedId) return;

    this.lastSelectedId = id;
    this.rowDetails = [];
    this.loading = true;

    this.administrationService.getBalance(parseInt(id)).subscribe({
      next: (response: any) => {
        if (response.success && response.hasData) {
          this.rowDetails = response.data;
        } else {
          this.rowDetails = [];
          alerts.basicAlert('Aviso', 'No hay datos disponibles', 'info');
        }
      },
      error: () => {
        this.rowDetails = [];
        alerts.basicAlert('Error', 'Error al cargar los datos', 'error');
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onDetailGridReady(params: GridReadyEvent) {
    this.detailsGridApi = params.api;
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
