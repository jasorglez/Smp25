import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { OtService } from 'app/services/ot.service';

@Component({
  selector: 'app-busquedas-ot',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './busquedas-ot.component.html',
  styleUrl: './busquedas-ot.component.scss'
})
export class BusquedasOtComponent {
  private otService = inject(OtService);
  private gridApi: GridApi | null = null;

  cdc = '';
  otNumber = '';
  area = '';
  rowData: any[] = [];
  loading = false;
  searched = false;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 110
  };

  columnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 90, pinned: 'left' },
    {
      field: 'active',
      headerName: 'Estado',
      width: 120,
      pinned: 'left',
      valueFormatter: ({ value }) => value === false ? 'BORRADA' : 'ACTIVA',
      cellClassRules: {
        'status-deleted': ({ value }) => value === false,
        'status-active': ({ value }) => value !== false
      }
    },
    {
      colId: 'logicalDeletion',
      headerName: 'Borrado lógico',
      width: 145,
      valueGetter: ({ data }) => data?.active === false ? 'Sí' : 'No'
    },
    { field: 'cdc', headerName: 'CDC', width: 130, pinned: 'left' },
    { field: 'otNumber', headerName: 'Número OT', width: 150, pinned: 'left' },
    { field: 'area', headerName: 'Área', width: 140 },
    {
      field: 'cuadrilla',
      headerName: 'Cuadrilla asignada',
      minWidth: 190,
      valueFormatter: ({ value }) => value || 'Sin asignar'
    },
    { field: 'idProject', headerName: 'ID Proyecto', width: 125 },
    { field: 'cuentaHoja', headerName: 'Hoja', width: 100 },
    { field: 'description', headerName: 'Descripción', minWidth: 260, flex: 1 },
    { field: 'assignedTo', headerName: 'Asignado a', minWidth: 170 },
    { field: 'nameConsumer', headerName: 'Usuario', minWidth: 190 },
    { field: 'propertyNumber', headerName: 'Cuenta/Predio', minWidth: 140 },
    { field: 'contractNumber', headerName: 'Contrato', minWidth: 130 },
    { field: 'phoneConsumer', headerName: 'Teléfono', minWidth: 140 },
    { field: 'address', headerName: 'Dirección', minWidth: 220 },
    { field: 'addressNumber', headerName: 'Número', width: 110 },
    { field: 'neighborhood', headerName: 'Colonia', minWidth: 180 },
    { field: 'chargePhase', headerName: 'Fase', width: 120 },
    { field: 'hydrometerNumber', headerName: 'Medidor', minWidth: 140 },
    { field: 'period', headerName: 'Periodo', width: 120 },
    { field: 'observations', headerName: 'Observaciones', minWidth: 240 },
    { field: 'results', headerName: 'Resultados', minWidth: 240 },
    { field: 'closed', headerName: 'Cerrada', width: 110, valueFormatter: ({ value }) => value ? 'Sí' : 'No' },
    { field: 'closedApp', headerName: 'Cerrada App', width: 125, valueFormatter: ({ value }) => value ? 'Sí' : 'No' },
    { field: 'registerDate', headerName: 'Fecha de registro', minWidth: 175, valueFormatter: ({ value }) => this.formatDate(value) },
    { field: 'closedAt', headerName: 'Fecha de cierre', minWidth: 175, valueFormatter: ({ value }) => this.formatDate(value) }
  ];

  gridOptions = {
    pagination: true,
    paginationPageSize: 50,
    paginationPageSizeSelector: [25, 50, 100, 500],
    animateRows: true,
    rowClassRules: {
      'deleted-row': ({ data }) => data?.active === false
    }
  };

  search(): void {
    this.loading = true;
    this.gridApi?.showLoadingOverlay();
    this.otService.searchOt(this.cdc, this.otNumber, this.area).subscribe({
      next: (data) => {
        this.rowData = Array.isArray(data) ? data : [];
        this.searched = true;
        this.loading = false;
        if (!this.rowData.length) {
          this.gridApi?.showNoRowsOverlay();
        }
      },
      error: (error) => {
        this.rowData = [];
        this.searched = true;
        this.loading = false;
        this.gridApi?.showNoRowsOverlay();
        const message = error?.error?.message || error?.error?.Message || error?.message
          || 'No fue posible consultar las órdenes de trabajo.';
        alerts.basicAlert('Error en la búsqueda', message, 'error');
      }
    });
  }

  clear(): void {
    this.cdc = '';
    this.otNumber = '';
    this.area = '';
    this.rowData = [];
    this.searched = false;
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  private formatDate(value: any): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-MX');
  }
}
